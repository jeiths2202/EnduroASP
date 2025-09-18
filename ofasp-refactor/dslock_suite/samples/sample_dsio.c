
#include "dsio.h"
#include <stdio.h>
#include <string.h>

int main(){
  char err[256]={0}; dsio_t h;
  // New dataset creation & catalog
  int rc = dsio_open2(&h,"VOL/APP/NEWFILE","WRITE","VOL1",80,"FB",1,err,sizeof(err));
  if(rc!=0){ printf("open2 failed: %s\n", err); return 1; }
  dsio_put_record(&h,"hello",5,err,sizeof(err));
  dsio_close(&h,err,sizeof(err));

  // Reopen to append
  rc = dsio_open(&h,"VOL/APP/NEWFILE","APPEND",err,sizeof(err));
  if(rc!=0){ printf("open failed: %s\n", err); return 1; }
  dsio_put_record(&h,"world",5,err,sizeof(err));
  dsio_close(&h,err,sizeof(err));
  return 0;
}
