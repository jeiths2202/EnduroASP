
#define _GNU_SOURCE
#include "dsio.h"
#include "dslock.h"
#include "error.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <errno.h>
#include <time.h>

#define ROOT_DEF "/var/datasets"

// ---------- Config handling ----------
typedef struct {
  char root[256];
  int fsync;
  int atomic;
  int recfm_fb_newline;
  int recfm_vb_newline;
  char catalog[256];
} ds_cfg_t;

static ds_cfg_t* cfg_cached=NULL;

static void cfg_defaults(ds_cfg_t* c){
  memset(c,0,sizeof(*c));
  strncpy(c->root, getenv("DSIO_ROOT")?getenv("DSIO_ROOT"):ROOT_DEF, sizeof(c->root)-1);
  c->fsync = (getenv("DSIO_FSYNC") && *getenv("DSIO_FSYNC")=='1');
  c->atomic= (getenv("DSIO_ATOMIC") && *getenv("DSIO_ATOMIC")=='1');
  c->recfm_fb_newline = (getenv("RECFM_FB_NEWLINE") && *getenv("RECFM_FB_NEWLINE")=='1');
  c->recfm_vb_newline = (getenv("RECFM_VB_NEWLINE") && *getenv("RECFM_VB_NEWLINE")=='1');
  const char* defcat = "./config/catalog.jsonl";
  strncpy(c->catalog, getenv("DSIO_CATALOG")?getenv("DSIO_CATALOG"):defcat, sizeof(c->catalog)-1);
}

static void cfg_load_from_json(ds_cfg_t* c){
  // optional simple JSON file pointed by DSIO_CONFIG
  const char* path = getenv("DSIO_CONFIG");
  if(!path || !*path) return;
  FILE* f=fopen(path,"r"); if(!f) return;
  char *line=NULL; size_t len=0; ssize_t rd;
  while((rd=getline(&line,&len,f))!=-1){
    // naive key search (flat object only)
    char* p;
    if((p=strstr(line,"\"DSIO_ROOT\"")))     { p=strchr(p,':'); if(p){ while(*++p==' '||*p=='\"'); char* e=strpbrk(p,"\",\n}"); if(e){ size_t n=e-p; if(n>0&&n<sizeof(c->root)){ memcpy(c->root,p,n); c->root[n]=0; }}}} 
    if((p=strstr(line,"\"DSIO_FSYNC\"")))    { p=strchr(p,':'); if(p){ c->fsync = atoi(p+1)!=0; } }
    if((p=strstr(line,"\"DSIO_ATOMIC\"")))   { p=strchr(p,':'); if(p){ c->atomic= atoi(p+1)!=0; } }
    if((p=strstr(line,"\"RECFM_FB_NEWLINE\""))){ p=strchr(p,':'); if(p){ c->recfm_fb_newline = atoi(p+1)!=0; } }
    if((p=strstr(line,"\"RECFM_VB_NEWLINE\""))){ p=strchr(p,':'); if(p){ c->recfm_vb_newline = atoi(p+1)!=0; } }
    if((p=strstr(line,"\"DSIO_CATALOG\"")))  { p=strchr(p,':'); if(p){ while(*++p==' '||*p=='\"'); char* e=strpbrk(p,"\",\n}"); if(e){ size_t n=e-p; if(n>0&&n<sizeof(c->catalog)){ memcpy(c->catalog,p,n); c->catalog[n]=0; }}}} 
  }
  free(line); fclose(f);
}

ds_cfg_t* cfg(){
  if(!cfg_cached){
    cfg_cached = (ds_cfg_t*)malloc(sizeof(ds_cfg_t));
    cfg_defaults(cfg_cached);
    cfg_load_from_json(cfg_cached);
  }
  return cfg_cached;
}

// ---------- Catalog handling ----------
typedef struct { char dataset[256]; char vol[32]; int lrecl; char recfm[4]; } cat_rec_t;

// External JSON catalog parser
extern int cat_find_json(const char* catalog_path, const char* dataset_name, 
                        char* vol_out, int* lrecl_out, char* recfm_out);

static int cat_load_all(cat_rec_t** out, int* outn){
  FILE* f=fopen(cfg()->catalog,"r"); if(!f){ *out=NULL; *outn=0; return DSERR_CATALOG_MISSING; }
  size_t cap=32; int n=0; cat_rec_t* arr=malloc(cap*sizeof(cat_rec_t)); if(!arr){ fclose(f); return DSERR_SYS; }
  char* line=NULL; size_t len=0; ssize_t rd;
  while((rd=getline(&line,&len,f))!=-1){
    cat_rec_t r; memset(&r,0,sizeof(r));
    char* p=strstr(line,"\"dataset\":\""); if(!p) continue; p+=11; char* e=strchr(p,'\"'); if(!e) continue; int dl=e-p; if(dl<=0||dl>=255) continue; strncpy(r.dataset,p,dl);
    p=strstr(e,"\"vol\":\""); if(!p) continue; p+=7; e=strchr(p,'\"'); if(!e) continue; int vl=e-p; if(vl<=0||vl>=31) continue; strncpy(r.vol,p,vl);
    p=strstr(e,"\"lrecl\":"); if(!p) continue; r.lrecl=strtol(p+8,NULL,10);
    p=strstr(e,"\"recfm\":\""); if(!p) continue; p+=9; e=strchr(p,'\"'); if(!e) continue; int rl=e-p; if(rl<=0||rl>=3) continue; strncpy(r.recfm,p,rl);
    if(n==(int)cap){ cap*=2; arr=realloc(arr,cap*sizeof(cat_rec_t)); if(!arr){ free(line); fclose(f); return DSERR_SYS; } }
    arr[n++]=r;
  }
  free(line); fclose(f); *out=arr; *outn=n; return DSERR_OK;
}

static int cat_find(const char* ds, cat_rec_t* out){
  // Use JSON catalog parser
  if (!out) return DSERR_BAD_ARGS;
  
  char vol[32] = {0};
  int lrecl = 0;
  char recfm[4] = {0};
  
  int rc = cat_find_json(cfg()->catalog, ds, vol, &lrecl, recfm);
  if (rc != DSERR_OK) return rc;
  
  // Fill output structure
  strncpy(out->dataset, ds, sizeof(out->dataset) - 1);
  strncpy(out->vol, vol, sizeof(out->vol) - 1);
  out->lrecl = lrecl;
  strncpy(out->recfm, recfm, sizeof(out->recfm) - 1);
  
  return DSERR_OK;
}

static int ensure_dir(const char* path){
  char tmp[512]; strncpy(tmp,path,sizeof(tmp)-1); tmp[sizeof(tmp)-1]=0;
  for(char* p=tmp+1; *p; ++p){ if(*p=='/'){ *p=0; if(mkdir(tmp,0777)<0 && errno!=EEXIST) return DSERR_IO; *p='/'; } }
  return DSERR_OK;
}

static int cat_append(const cat_rec_t* rec){
  // ensure directory exists
  if(ensure_dir(cfg()->catalog)!=DSERR_OK) return DSERR_IO;
  FILE* f=fopen(cfg()->catalog,"a"); if(!f) return DSERR_IO;
  fprintf(f,"{\"dataset\":\"%s\",\"vol\":\"%s\",\"lrecl\":%d,\"recfm\":\"%s\"}\n",
          rec->dataset, rec->vol, rec->lrecl, rec->recfm);
  fclose(f); return DSERR_OK;
}

// ---------- Path helpers ----------
static int map_path(const char* dataset, char* out, int outn){
  if(!dataset||!*dataset) return DSERR_BAD_ARGS;
  int n=snprintf(out,outn,"%s/%s",cfg()->root,dataset);
  return (n>0 && n<outn)?DSERR_OK:DSERR_BUFFER_SMALL;
}

static int apply_fd_lock(int fd, int write_lock){
  struct flock fl={0}; fl.l_type = write_lock?F_WRLCK:F_RDLCK; fl.l_whence=SEEK_SET; fl.l_start=0; fl.l_len=0;
  return fcntl(fd, F_SETLK, &fl);
}

static void seterr(char* e,int n, ds_err_t code, const char* detail){
  if(!e||n<=0) return;
  snprintf(e,n,"%s: %s%s%s", ds_strerror_code(code), ds_strerror_msg(code),
           (detail&&*detail)?" - ":"", (detail&&*detail)?detail:"");
}

// ---------- Open helpers ----------
static const char* level_from_mode(const char* mode){
  if(!mode) return NULL;
  if(!strncasecmp(mode,"READ",4))  return "SHR";
  if(!strncasecmp(mode,"WRITE",5)) return "OLD";
  if(!strncasecmp(mode,"APPEND",6))return "MOD";
  return NULL;
}

static void recfm_upper2(char* out,const char* in){
  out[0]=out[1]=0;
  if(!in) return;
  for(int i=0;i<2 && in[i]; ++i){ char c=in[i]; if(c>='a'&&c<='z') c-='a'-'A'; out[i]=c; }
  out[2]=0;
}

static int derive_newline_policy(const char* recfm){
  if(!recfm) return 0;
  if(!strcmp(recfm,"FB")) return cfg()->recfm_fb_newline;
  if(!strcmp(recfm,"VB")) return cfg()->recfm_vb_newline;
  return 0;
}

static int open_common(dsio_t* h, const char* dataset, const char* mode, const cat_rec_t* meta, char* err, int errlen){
  if(!h){ seterr(err,errlen,DSERR_BAD_ARGS,"bad handle"); return DSERR_BAD_ARGS; }
  memset(h,0,sizeof(*h)); h->fd=-1;
  const char* level = level_from_mode(mode);
  if(!level){ seterr(err,errlen,DSERR_BAD_ARGS,"mode must be READ/WRITE/APPEND"); return DSERR_BAD_ARGS; }

  int rc = dslock_acquire(dataset, level, err, errlen);
  if(rc==DSERR_CONFLICT){ seterr(err,errlen,DSERR_CONFLICT,"already locked"); return DSERR_CONFLICT; }
  if(rc<0){ return rc; }
  h->owns_lock=1; strncpy(h->dataset,dataset,sizeof(h->dataset)-1);
  strncpy(h->level,level,sizeof(h->level)-1);

  // recfm context from catalog meta (may be zero for old datasets)
  if(meta){
    strncpy(h->recfm, meta->recfm, sizeof(h->recfm)-1);
    h->lrecl = meta->lrecl;
  }
  h->newline_on_write = derive_newline_policy(h->recfm);

  if(map_path(dataset,h->path,sizeof(h->path))<0){ seterr(err,errlen,DSERR_BUFFER_SMALL,"path"); goto fail; }
  if(ensure_dir(h->path)<0){ seterr(err,errlen,DSERR_IO,"mkdir -p"); goto fail; }

  int flags=0, modebits=0666;
  if(!strcmp(level,"SHR"))            flags = O_RDONLY;
  else if(!strcmp(level,"OLD"))       flags = O_RDWR|O_CREAT|O_TRUNC;
  else                                flags = O_WRONLY|O_CREAT|O_APPEND;

  h->atomic = (!strcmp(level,"OLD")) && cfg()->atomic;
  const char* open_path = h->path;
  if(h->atomic){
    snprintf(h->tmp, sizeof(h->tmp), "%s.tmp.%d", h->path, (int)getpid());
    open_path = h->tmp;
    flags = O_WRONLY|O_CREAT|O_TRUNC;
  }

  int fd = open(open_path, flags, modebits);
  if(fd<0){ seterr(err,errlen,DSERR_IO,"open"); goto fail; }
  apply_fd_lock(fd, strcmp(level,"SHR")!=0);
  h->fd = fd;
  return DSERR_OK;

fail:
  if(h->owns_lock){ char e2[64]={0}; dslock_release(dataset,e2,sizeof(e2)); h->owns_lock=0; }
  return DSERR_IO;
}

// ---------- Public API ----------
int dsio_open(dsio_t* h, const char* dataset, const char* mode, char* err, int errlen){
  cat_rec_t meta; int rc = cat_find(dataset,&meta);
  if(rc==DSERR_NOT_FOUND){ seterr(err,errlen,DSERR_DATASET_NOT_EXIST,"not in catalog"); return DSERR_DATASET_NOT_EXIST; }
  if(rc<0 && rc!=DSERR_NOT_FOUND){ seterr(err,errlen,rc,"catalog error"); return rc; }
  return open_common(h,dataset,mode,(rc==DSERR_OK)?&meta:NULL,err,errlen);
}

int dsio_open2(dsio_t* h, const char* dataset, const char* mode,
               const char* vol, int lrecl, const char* recfm,
               int create_if_missing, char* err, int errlen){
  cat_rec_t meta; int rc = cat_find(dataset,&meta);
  if(rc==DSERR_OK){
    // already exists in catalog
    if(create_if_missing){
      seterr(err,errlen,DSERR_ALREADY_CATALOGED,"dataset exists");
      return DSERR_ALREADY_CATALOGED;
    }
    // open existing
    return open_common(h,dataset,mode,&meta,err,errlen);
  }else if(rc==DSERR_NOT_FOUND){
    if(!create_if_missing){
      seterr(err,errlen,DSERR_DATASET_NOT_EXIST,"not cataloged");
      return DSERR_DATASET_NOT_EXIST;
    }
    // create new catalog entry
    cat_rec_t nmeta; memset(&nmeta,0,sizeof(nmeta));
    strncpy(nmeta.dataset,dataset,sizeof(nmeta.dataset)-1);
    if(vol) strncpy(nmeta.vol,vol,sizeof(nmeta.vol)-1);
    nmeta.lrecl = lrecl>0?lrecl:0;
    recfm_upper2(nmeta.recfm,recfm?recfm:"FB");
    int rc2 = cat_append(&nmeta);
    if(rc2<0){ seterr(err,errlen,rc2,"catalog append"); return rc2; }
    return open_common(h,dataset,mode,&nmeta,err,errlen);
  }
  seterr(err,errlen,rc,"catalog error");
  return rc;
}

ssize_t dsio_read(dsio_t* h, void* buf, size_t n, char* err, int errlen){
  if(!h || h->fd<0){ seterr(err,errlen,DSERR_BAD_ARGS,"bad handle"); return DSERR_BAD_ARGS; }
  ssize_t r = read(h->fd, buf, n);
  if(r<0){ seterr(err,errlen,DSERR_IO,"read"); return DSERR_IO; }
  return r;
}

ssize_t dsio_write(dsio_t* h, const void* buf, size_t n, char* err, int errlen){
  if(!h || h->fd<0){ seterr(err,errlen,DSERR_BAD_ARGS,"bad handle"); return DSERR_BAD_ARGS; }
  ssize_t w = write(h->fd, buf, n);
  if(w<0){ seterr(err,errlen,DSERR_IO,"write"); return DSERR_IO; }
  if(w>=0 && cfg()->fsync) fsync(h->fd);
  return w;
}

ssize_t dsio_put_record(dsio_t* h, const void* buf, size_t n, char* err, int errlen){
  ssize_t w = dsio_write(h, buf, n, err, errlen);
  if(w<0) return w;
  if(h->newline_on_write){
    const char nl='\n';
    ssize_t w2 = dsio_write(h, &nl, 1, err, errlen);
    if(w2<0) return w2;
    return w + w2;
  }
  return w;
}

int dsio_close(dsio_t* h, char* err, int errlen){
  if(!h) return DSERR_OK;
  int rc=DSERR_OK;
  if(h->fd>=0){
    if(cfg()->fsync) fsync(h->fd);
    if(close(h->fd)<0){ seterr(err,errlen,DSERR_IO,"close"); rc=DSERR_IO; }
    h->fd=-1;
  }
  if(h->atomic){
    if(rename(h->tmp, h->path)<0){ seterr(err,errlen,DSERR_IO,"rename commit"); rc=DSERR_IO; }
  }
  if(h->owns_lock){
    char e2[128]={0};
    int r2 = dslock_release(h->dataset,e2,sizeof(e2));
    if(r2<0){ if(rc==DSERR_OK) seterr(err,errlen,DSERR_IO,"unlock"); rc=DSERR_IO; }
    h->owns_lock=0;
  }
  memset(h,0,sizeof(*h));
  return rc;
}
