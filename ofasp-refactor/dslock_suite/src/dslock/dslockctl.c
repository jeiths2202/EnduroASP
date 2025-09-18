
#include "dslock.h"
#include "error.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

int main(int argc,char**argv){
    char err[256]={0}, buf[65536]={0};
    if(argc<2){ 
        fprintf(stderr,"usage: %s <command> [args...]\n",argv[0]); 
        fprintf(stderr,"commands:\n");
        fprintf(stderr,"  init                        - initialize database (create directory and empty db)\n");
        fprintf(stderr,"  list [DATASET]              - list locks (optionally for specific dataset)\n");
        fprintf(stderr,"  sweep                       - remove stale locks\n");
        fprintf(stderr,"  lock DATASET LEVEL          - acquire lock (LEVEL: SHR|OLD|MOD)\n");
        fprintf(stderr,"  unlock DATASET              - release lock\n");
        fprintf(stderr,"  query [--user USER] [--pid PID] [--dataset DATASET] - advanced query\n");
        fprintf(stderr,"  cleanup --pid PID           - force cleanup by PID\n");
        fprintf(stderr,"  cleanup --dataset DATASET  - force cleanup by dataset\n");
        return 1; 
    }
    if(!strcmp(argv[1],"init")){
        int rc=dslock_init_database(err,sizeof(err));
        if(rc<0){ fprintf(stderr,"err: %s\n",err); return 2; }
        puts("Database initialized successfully"); return 0;
    }else if(!strcmp(argv[1],"list")){
        const char* ds = (argc>=3)?argv[2]:NULL;
        int n=dslock_status(ds,buf,sizeof(buf),err,sizeof(err));
        if(n<0){ fprintf(stderr,"err: %s\n",err); return 2; }
        puts(buf); return 0;
    }else if(!strcmp(argv[1],"sweep")){
        int k=dslock_sweep(err,sizeof(err));
        if(k<0){ fprintf(stderr,"err: %s\n",err); return 2; }
        printf("removed=%d\n",k); return 0;
    }else if(!strcmp(argv[1],"lock") && argc==4){
        int rc=dslock_acquire(argv[2],argv[3],err,sizeof(err));
        if(rc==DSERR_CONFLICT){ puts("conflict: already locked"); return 1; }
        if(rc<0){ fprintf(stderr,"err: %s\n",err); return 2; }
        puts("ok"); return 0;
    }else if(!strcmp(argv[1],"unlock") && argc==3){
        int rc=dslock_release(argv[2],err,sizeof(err));
        if(rc==DSERR_NOT_FOUND){ puts("not_found"); return 1; }
        if(rc<0){ fprintf(stderr,"err: %s\n",err); return 2; }
        puts("ok"); return 0;
    }else if(!strcmp(argv[1],"query")){
        // Advanced query with filters
        const char* filter_user = NULL;
        pid_t filter_pid = 0;
        const char* filter_dataset = NULL;
        
        // Parse filter options
        for(int i=2; i<argc-1; i++){
            if(!strcmp(argv[i],"--user") && i+1<argc) { filter_user = argv[++i]; }
            else if(!strcmp(argv[i],"--pid") && i+1<argc) { filter_pid = atoi(argv[++i]); }
            else if(!strcmp(argv[i],"--dataset") && i+1<argc) { filter_dataset = argv[++i]; }
        }
        
        int n = dslock_query_locks(filter_user, filter_pid, filter_dataset, buf, sizeof(buf), err, sizeof(err));
        if(n<0){ fprintf(stderr,"err: %s\n",err); return 2; }
        puts(buf); return 0;
    }else if(!strcmp(argv[1],"cleanup")){
        // Force cleanup by PID or dataset
        pid_t target_pid = 0;
        const char* target_dataset = NULL;
        
        for(int i=2; i<argc-1; i++){
            if(!strcmp(argv[i],"--pid") && i+1<argc) { target_pid = atoi(argv[++i]); }
            else if(!strcmp(argv[i],"--dataset") && i+1<argc) { target_dataset = argv[++i]; }
        }
        
        if(target_pid <= 0 && (!target_dataset || !*target_dataset)) {
            fprintf(stderr,"cleanup: must specify --pid PID or --dataset DATASET\n"); return 1;
        }
        
        int rc = dslock_force_cleanup(target_pid, target_dataset, err, sizeof(err));
        if(rc==DSERR_NOT_FOUND){ puts("not_found"); return 1; }
        if(rc<0){ fprintf(stderr,"err: %s\n",err); return 2; }
        printf("removed=%d\n",rc); return 0;
    }
    fprintf(stderr,"bad args\n"); return 1;
}
