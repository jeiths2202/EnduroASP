#include <stdio.h>
#include "error.h"

int main() {
    printf("Error test: %s\n", ds_error_msg(DSERR_ALREADY_CATALOGED));
    return 0;
}
