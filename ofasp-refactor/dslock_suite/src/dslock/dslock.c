
#define _GNU_SOURCE
#include "dslock.h"
#include "error.h"
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <signal.h>
#include <errno.h>
#include <time.h>
#include <stdlib.h>
#include <pwd.h>

#define DB_DEF "/home/aspuser/app/ofasp-refactor/dslock_suite/database/dslock.dat"
#define LCK_SUFFIX ".lck"
#define TTL_DEF 3600

typedef struct { char dataset[256]; char level[8]; pid_t pid; long ts; char user[32]; char time_str[16]; } Rec;

static char* get_config_db_path() {
    static char db_path[512] = {0};
    if(db_path[0]) return db_path; // Cache the result
    
    // Read from config.json first (highest priority)
    char config_found = 0;
    FILE* cfg = fopen("/home/aspuser/app/ofasp-refactor/dslock_suite/config/config.json", "r");
    if(cfg) {
        char line[1024], hostname[256];
        char db_dir[256] = "/home/aspuser/app/ofasp-refactor/dslock_suite/database";
        char db_file[256] = "";
        
        // Get hostname
        if(gethostname(hostname, sizeof(hostname)) != 0) strcpy(hostname, "localhost");
        
        while(fgets(line, sizeof(line), cfg)) {
            if(strstr(line, "DSLOCK_DATABASE_DIR") && strchr(line, ':')) {
                char* colon = strchr(line, ':'); if(!colon) continue;
                char* start = strchr(colon, '"'); if(!start) continue;
                start++; char* end = strchr(start, '"'); if(!end) continue;
                *end = 0; strncpy(db_dir, start, sizeof(db_dir)-1);
            }
            if(strstr(line, "DSLOCK_DATABASE_FILE") && strchr(line, ':')) {
                char* colon = strchr(line, ':'); if(!colon) continue;
                char* start = strchr(colon, '"'); if(!start) continue;
                start++; char* end = strchr(start, '"'); if(!end) continue;
                *end = 0; 
                // Replace ${hostname} with actual hostname
                if(strstr(start, "${hostname}")) {
                    snprintf(db_file, sizeof(db_file), "%s.dat", hostname);
                } else {
                    strncpy(db_file, start, sizeof(db_file)-1);
                }
            }
        }
        fclose(cfg);
        
        if(!*db_file) strcpy(db_file, "dslock.dat");
        snprintf(db_path, sizeof(db_path), "%s/%s", db_dir, db_file);
        config_found = 1;
    }
    
    // Try environment variable second
    if(!config_found) {
        const char* env_path = getenv("DSLOCK_DB");
        if(env_path && *env_path) { 
            strncpy(db_path, env_path, sizeof(db_path)-1); 
            return db_path; 
        }
    }
    
    // Fallback to default using same logic as config.json
    if(!config_found) {
        char hostname[256];
        if(gethostname(hostname, sizeof(hostname)) != 0) strcpy(hostname, "localhost");
        snprintf(db_path, sizeof(db_path), "/home/aspuser/app/ofasp-refactor/dslock_suite/database/%s.dat", hostname);
    }
    
    return db_path;
}

static const char* env_db()  { return get_config_db_path(); }
static long        env_ttl() { const char* p=getenv("DSLOCK_TTL_SEC"); return p?strtol(p,0,10):TTL_DEF; }
static int         env_log() { const char* p=getenv("DSLOCK_LOG"); return (p&&*p=='1'); }

static void seterr(char* e,int n,const char* msg){ if(e&&n>0){snprintf(e,n,"%s (errno=%d)",msg,errno);} }
static int lock_global(int *lck_fd, char* err,int errn){
    char path[512]; snprintf(path,sizeof(path),"%s%s", env_db(), LCK_SUFFIX);
    int fd = open(path, O_CREAT|O_RDWR, 0666); if(fd<0){ seterr(err,errn,"open lock"); return DSERR_SYS; }
    struct flock fl={.l_type=F_WRLCK,.l_whence=SEEK_SET,.l_start=0,.l_len=0};
    if(fcntl(fd,F_SETLKW,&fl)<0){ seterr(err,errn,"fcntl lock"); close(fd); return DSERR_SYS; }
    *lck_fd=fd; return DSERR_OK;
}
static void unlock_global(int lck_fd){ if(lck_fd>=0){ struct flock fl={.l_type=F_UNLCK,.l_whence=SEEK_SET,.l_start=0,.l_len=0}; fcntl(lck_fd,F_SETLK,&fl); close(lck_fd);} }

static int parse_line(const char* s, Rec* r){
    const char *d=strstr(s,"\"dataset\":\""), *l=strstr(s,"\"level\":\""), *p=strstr(s,"\"pid\":"), *t=strstr(s,"\"ts\":"), *u=strstr(s,"\"user\":\"");
    const char *lt=strstr(s,"\"lock_time\":\"");  // New lock_time field
    if(!d||!l||!p||!t) return DSERR_PARSE;
    d+=11; const char* de=strchr(d,'\"'); if(!de) return DSERR_PARSE; int dl=de-d; if(dl<=0||dl>=255) return DSERR_PARSE;
    strncpy(r->dataset,d,dl); r->dataset[dl]=0;
    l+=9; const char* le=strchr(l,'\"'); if(!le) return DSERR_PARSE; int ll=le-l; if(ll<=0||ll>=7) return DSERR_PARSE;
    strncpy(r->level,l,ll); r->level[ll]=0;
    r->pid=(pid_t)strtol(p+6,NULL,10);
    r->ts =strtol(t+5,NULL,10);
    // Parse lock_time if available (new format), otherwise generate from ts (backward compatibility)
    if(lt) {
        lt+=13; const char* lte=strchr(lt,'\"'); 
        if(lte) { 
            int ltl=lte-lt; 
            if(ltl>0&&ltl<15) { 
                strncpy(r->time_str,lt,ltl); r->time_str[ltl]=0; 
            } else { 
                r->time_str[0]=0; 
            } 
        } else { 
            r->time_str[0]=0; 
        }
    } else {
        // Generate time_str from ts for backward compatibility with old records
        struct tm* tm_info = localtime(&r->ts);
        strftime(r->time_str, sizeof(r->time_str), "%H:%M:%S", tm_info);
    }
    // Parse user field (backward compatibility - may not exist in old records)
    if(u) {
        u+=8; const char* ue=strchr(u,'\"'); if(ue) { int ul=ue-u; if(ul>0&&ul<31) { strncpy(r->user,u,ul); r->user[ul]=0; } else { r->user[0]=0; } } else { r->user[0]=0; }
    } else {
        r->user[0]=0; // Empty user for backward compatibility
    }
    return DSERR_OK;
}
static void rec_write(FILE* f,const Rec* r){
    fprintf(f,"{\"dataset\":\"%s\",\"level\":\"%s\",\"pid\":%d,\"ts\":%ld,\"lock_time\":\"%s\",\"user\":\"%s\"}\n",
            r->dataset,r->level,(int)r->pid,r->ts,r->time_str,r->user);
}

static int load_all(Rec** out,int* outn){
    const char* db=env_db(); FILE* f=fopen(db,"r"); if(!f){ *out=NULL; *outn=0; return DSERR_OK; }
    size_t cap=32; int n=0; Rec* arr=malloc(cap*sizeof(Rec)); if(!arr){ fclose(f); return DSERR_SYS; }
    char *line=NULL; size_t len=0; ssize_t rd;
    while((rd=getline(&line,&len,f))!=-1){
        Rec r; if(parse_line(line,&r)==DSERR_OK){ if(n==(int)cap){ cap*=2; arr=realloc(arr,cap*sizeof(Rec)); if(!arr){free(line); fclose(f); return DSERR_SYS;} } arr[n++]=r; }
    }
    free(line); fclose(f); *out=arr; *outn=n; return DSERR_OK;
}
static int write_all(Rec* arr,int n){
    const char* db=env_db(); char tmp[512]; snprintf(tmp,sizeof(tmp),"%s.tmp",db);
    FILE* f=fopen(tmp,"w"); if(!f) return DSERR_SYS;
    for(int i=0;i<n;i++) rec_write(f,&arr[i]);
    fflush(f); fsync(fileno(f)); fclose(f);
    if(rename(tmp,db)<0) return DSERR_SYS; return DSERR_OK;
}
static int is_alive(pid_t pid){ return (kill(pid,0)==0 || errno==EPERM); }
static int is_excl(const char* lv){ return (!strcmp(lv,"OLD")||!strcmp(lv,"MOD")); }

static void upcase3(char* dst,const char* src){
    dst[0]=dst[1]=dst[2]=0; for(int i=0;i<3 && src[i];++i){ char c=src[i]; if(c>='a'&&c<='z') c-='a'-'A'; dst[i]=c; } dst[3]=0;
}

static int sweep_inplace(Rec** parr,int* pn){
    long ttl=env_ttl(); time_t now=time(NULL);
    Rec* a=*parr; int n=*pn, w=0;
    for(int i=0;i<n;i++){
        int stale= (!is_alive(a[i].pid)) || (now - a[i].ts > ttl);
        if(!stale) a[w++]=a[i];
    }
    *pn=w; return DSERR_OK;
}

int dslock_sweep(char* err,int errn){
    int lfd; if(lock_global(&lfd,err,errn)<0) return DSERR_SYS;
    Rec* a; int n; if(load_all(&a,&n)<0){ unlock_global(lfd); seterr(err,errn,"load db"); return DSERR_SYS; }
    int before=n; sweep_inplace(&a,&n);
    if(write_all(a,n)<0){ free(a); unlock_global(lfd); seterr(err,errn,"write db"); return DSERR_SYS; }
    free(a); unlock_global(lfd); if(env_log()) fprintf(stderr,"[dslock] sweep removed %d\n", before-n);
    return before-n;
}

int dslock_acquire(const char* dataset,const char* level,char* err,int errn){
    if(!dataset||!level||!*dataset||!*level){ seterr(err,errn,"bad args"); return DSERR_BAD_ARGS; }
    char lv[4]; upcase3(lv,level);
    if(strcmp(lv,"SHR")&&strcmp(lv,"OLD")&&strcmp(lv,"MOD")){ seterr(err,errn,"bad level"); return DSERR_BAD_ARGS; }
    int lfd; if(lock_global(&lfd,err,errn)<0) return DSERR_SYS;

    Rec* a; int n; if(load_all(&a,&n)<0){ unlock_global(lfd); seterr(err,errn,"load db"); return DSERR_SYS; }
    sweep_inplace(&a,&n);
    int conflict=0;
    for(int i=0;i<n;i++){
        if(strcmp(a[i].dataset,dataset)) continue;
        if(!strcmp(lv,"SHR")){ if(is_excl(a[i].level)){ conflict=1; break; } }
        else { conflict=1; break; }
    }
    if(conflict){ free(a); unlock_global(lfd); if(err) snprintf(err,errn,"already locked"); return DSERR_CONFLICT; }

    Rec r; strncpy(r.dataset,dataset,sizeof(r.dataset)-1); r.dataset[sizeof(r.dataset)-1]=0;
    strncpy(r.level,lv,sizeof(r.level)-1); r.level[sizeof(r.level)-1]=0;
    r.pid=getpid(); r.ts=time(NULL);
    // Format time as HH:MM:SS
    struct tm* tm_info = localtime(&r.ts);
    strftime(r.time_str, sizeof(r.time_str), "%H:%M:%S", tm_info);
    // Get current user name
    struct passwd* pw = getpwuid(getuid());
    if(pw && pw->pw_name) {
        strncpy(r.user, pw->pw_name, sizeof(r.user)-1); r.user[sizeof(r.user)-1]=0;
    } else {
        snprintf(r.user, sizeof(r.user), "%d", (int)getuid());
    }
    a=realloc(a,(n+1)*sizeof(Rec)); if(!a){ unlock_global(lfd); seterr(err,errn,"oom"); return DSERR_SYS; }
    a[n++]=r;
    if(write_all(a,n)<0){ free(a); unlock_global(lfd); seterr(err,errn,"write db"); return DSERR_SYS; }
    free(a); unlock_global(lfd); if(env_log()) fprintf(stderr,"[dslock] acquire %s %s pid=%d\n",lv,dataset,(int)getpid());
    return DSERR_OK;
}

int dslock_release(const char* dataset,char* err,int errn){
    if(!dataset||!*dataset){ seterr(err,errn,"bad args"); return DSERR_BAD_ARGS; }
    int lfd; if(lock_global(&lfd,err,errn)<0) return DSERR_SYS;

    Rec* a; int n; if(load_all(&a,&n)<0){ unlock_global(lfd); seterr(err,errn,"load db"); return DSERR_SYS; }
    sweep_inplace(&a,&n);
    int w=0, removed=0; pid_t me=getpid();
    for(int i=0;i<n;i++){
        if(!strcmp(a[i].dataset,dataset) && a[i].pid==me){ removed++; continue; }
        a[w++]=a[i];
    }
    if(!removed){ free(a); unlock_global(lfd); return DSERR_NOT_FOUND; }
    if(write_all(a,w)<0){ free(a); unlock_global(lfd); seterr(err,errn,"write db"); return DSERR_SYS; }
    free(a); unlock_global(lfd); if(env_log()) fprintf(stderr,"[dslock] release %s pid=%d removed=%d\n",dataset,(int)me,removed);
    return DSERR_OK;
}

int dslock_status(const char* dataset,char* out,int outn,char* err,int errn){
    if(!out||outn<4){ seterr(err,errn,"small buffer"); return DSERR_BUFFER_SMALL; }
    int lfd; if(lock_global(&lfd,err,errn)<0) return DSERR_SYS;
    Rec* a; int n; if(load_all(&a,&n)<0){ unlock_global(lfd); seterr(err,errn,"load db"); return DSERR_SYS; }
    sweep_inplace(&a,&n);
    int pos=0; pos+=snprintf(out+pos,outn-pos,"[");
    for(int i=0;i<n;i++){
        if(dataset && *dataset && strcmp(a[i].dataset,dataset)) continue;
        int w=snprintf(out+pos, outn-pos,
            "%s{\"dataset\":\"%s\",\"level\":\"%s\",\"pid\":%d,\"ts\":%ld,\"lock_time\":\"%s\",\"user\":\"%s\"}",
            (pos>1?",":""), a[i].dataset,a[i].level,(int)a[i].pid,a[i].ts,a[i].time_str,a[i].user);
        if(w<0||w>=outn-pos){ free(a); unlock_global(lfd); seterr(err,errn,"buffer full"); return DSERR_BUFFER_SMALL; }
        pos+=w;
    }
    if(pos>=outn-2){ free(a); unlock_global(lfd); seterr(err,errn,"buffer full"); return DSERR_BUFFER_SMALL; }
    pos+=snprintf(out+pos,outn-pos,"]");
    free(a); unlock_global(lfd); return pos;
}

// ============= Administrative APIs =============

int dslock_query_locks(const char* filter_user, pid_t filter_pid, const char* filter_dataset, 
                      char* out, int outn, char* err, int errn) {
    if(!out||outn<4){ seterr(err,errn,"small buffer"); return DSERR_BUFFER_SMALL; }
    int lfd; if(lock_global(&lfd,err,errn)<0) return DSERR_SYS;
    Rec* a; int n; if(load_all(&a,&n)<0){ unlock_global(lfd); seterr(err,errn,"load db"); return DSERR_SYS; }
    sweep_inplace(&a,&n);
    
    int pos=0; pos+=snprintf(out+pos,outn-pos,"[");
    for(int i=0;i<n;i++){
        // Apply filters
        if(filter_user && *filter_user && strcmp(a[i].user, filter_user)) continue;
        if(filter_pid > 0 && a[i].pid != filter_pid) continue;
        if(filter_dataset && *filter_dataset && strcmp(a[i].dataset, filter_dataset)) continue;
        
        // Get additional process info
        char proc_info[128] = "";
        char proc_path[64];
        snprintf(proc_path, sizeof(proc_path), "/proc/%d/comm", (int)a[i].pid);
        FILE* pf = fopen(proc_path, "r");
        if(pf) {
            char comm[64];
            if(fgets(comm, sizeof(comm), pf)) {
                // Remove trailing newline
                char* nl = strchr(comm, '\n');
                if(nl) *nl = '\0';
                snprintf(proc_info, sizeof(proc_info), ",\"process\":\"%s\"", comm);
            }
            fclose(pf);
        }
        
        int w=snprintf(out+pos, outn-pos,
            "%s{\"dataset\":\"%s\",\"level\":\"%s\",\"pid\":%d,\"lock_time\":\"%s\",\"user\":\"%s\"%s}",
            (pos>1?",":""), a[i].dataset,a[i].level,(int)a[i].pid,a[i].time_str,a[i].user,proc_info);
        if(w<0||w>=outn-pos){ free(a); unlock_global(lfd); seterr(err,errn,"buffer full"); return DSERR_BUFFER_SMALL; }
        pos+=w;
    }
    if(pos>=outn-2){ free(a); unlock_global(lfd); seterr(err,errn,"buffer full"); return DSERR_BUFFER_SMALL; }
    pos+=snprintf(out+pos,outn-pos,"]");
    free(a); unlock_global(lfd); return pos;
}

int dslock_force_cleanup(pid_t target_pid, const char* target_dataset, char* err, int errn) {
    if(target_pid <= 0 && (!target_dataset || !*target_dataset)) { 
        seterr(err,errn,"must specify pid or dataset"); return DSERR_BAD_ARGS; 
    }
    
    int lfd; if(lock_global(&lfd,err,errn)<0) return DSERR_SYS;
    Rec* a; int n; if(load_all(&a,&n)<0){ unlock_global(lfd); seterr(err,errn,"load db"); return DSERR_SYS; }
    
    int w=0, removed=0;
    for(int i=0;i<n;i++){
        int should_remove = 0;
        
        // Check if this lock matches removal criteria
        if(target_pid > 0 && a[i].pid == target_pid) should_remove = 1;
        if(target_dataset && *target_dataset && !strcmp(a[i].dataset, target_dataset)) should_remove = 1;
        
        if(should_remove) {
            removed++;
            if(env_log()) fprintf(stderr,"[dslock] force cleanup: %s %s pid=%d user=%s\n",
                                 a[i].level, a[i].dataset, (int)a[i].pid, a[i].user);
            continue;
        }
        a[w++]=a[i];
    }
    
    if(!removed){ free(a); unlock_global(lfd); return DSERR_NOT_FOUND; }
    if(write_all(a,w)<0){ free(a); unlock_global(lfd); seterr(err,errn,"write db"); return DSERR_SYS; }
    free(a); unlock_global(lfd); 
    if(env_log()) fprintf(stderr,"[dslock] force cleanup completed: %d locks removed\n", removed);
    return removed;
}

int dslock_init_database(char* err, int errn) {
    const char* db_path = env_db();
    char dir_path[512];
    
    // Extract directory path
    strncpy(dir_path, db_path, sizeof(dir_path)-1);
    dir_path[sizeof(dir_path)-1] = 0;
    char* last_slash = strrchr(dir_path, '/');
    if(last_slash) *last_slash = 0;
    
    // Create directory if it doesn't exist
    struct stat st;
    if(stat(dir_path, &st) != 0) {
        if(mkdir(dir_path, 0755) != 0) {
            seterr(err, errn, "failed to create database directory");
            return DSERR_SYS;
        }
    }
    
    // Create empty database file
    FILE* f = fopen(db_path, "w");
    if(!f) {
        seterr(err, errn, "failed to create database file");
        return DSERR_SYS;
    }
    fclose(f);
    
    if(env_log()) fprintf(stderr, "[dslock] database initialized: %s\n", db_path);
    return DSERR_OK;
}
