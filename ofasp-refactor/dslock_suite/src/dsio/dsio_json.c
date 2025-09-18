/**
 * JSON Catalog Parser for dsio
 * Reads catalog.json format from OpenASP
 */

#define _GNU_SOURCE
#include "dsio.h"
#include "error.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

// Config structure from dsio.c
typedef struct {
  char root[256];
  int fsync;
  int atomic;
  int recfm_fb_newline;
  int recfm_vb_newline;
  char catalog[256];
} ds_cfg_t;

// External config getter
extern ds_cfg_t* cfg(void);

// Catalog record structure
typedef struct { char dataset[256]; char vol[32]; int lrecl; char recfm[4]; } cat_rec_t;

// Simple JSON parser state
typedef struct {
    const char* json;
    size_t pos;
    size_t len;
} json_parser_t;

// Skip whitespace
static void skip_ws(json_parser_t* p) {
    while (p->pos < p->len && isspace(p->json[p->pos])) {
        p->pos++;
    }
}

// Find next occurrence of character
static int find_char(json_parser_t* p, char c) {
    while (p->pos < p->len) {
        if (p->json[p->pos] == c) return 1;
        p->pos++;
    }
    return 0;
}

// Extract string value between quotes
static int extract_string(json_parser_t* p, char* out, size_t max_len) {
    skip_ws(p);
    if (p->pos >= p->len || p->json[p->pos] != '"') return -1;
    p->pos++; // skip opening quote
    
    size_t start = p->pos;
    while (p->pos < p->len && p->json[p->pos] != '"') {
        if (p->json[p->pos] == '\\') p->pos++; // skip escaped char
        p->pos++;
    }
    
    if (p->pos >= p->len) return -1;
    
    size_t len = p->pos - start;
    if (len >= max_len) len = max_len - 1;
    strncpy(out, p->json + start, len);
    out[len] = '\0';
    
    p->pos++; // skip closing quote
    return 0;
}

// Extract number value
static int extract_number(json_parser_t* p) {
    skip_ws(p);
    char buf[32];
    size_t start = p->pos;
    size_t i = 0;
    
    while (p->pos < p->len && i < 31 && 
           (isdigit(p->json[p->pos]) || p->json[p->pos] == '-')) {
        buf[i++] = p->json[p->pos++];
    }
    buf[i] = '\0';
    
    return atoi(buf);
}

// Parse catalog.json and extract dataset info
int cat_find_json(const char* catalog_path, const char* dataset_name, 
                  char* vol_out, int* lrecl_out, char* recfm_out) {
    FILE* f = fopen(catalog_path, "r");
    if (!f) return DSERR_CATALOG_MISSING;
    
    // Read entire file
    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    fseek(f, 0, SEEK_SET);
    
    char* json = malloc(fsize + 1);
    if (!json) {
        fclose(f);
        return DSERR_SYS;
    }
    
    fread(json, 1, fsize, f);
    json[fsize] = '\0';
    fclose(f);
    
    // Parse dataset path: DISK01/TESTLIB/EMPLOYEE.FB
    char volume[32], library[64], filename[128];
    if (sscanf(dataset_name, "%31[^/]/%63[^/]/%127s", 
               volume, library, filename) != 3) {
        free(json);
        return DSERR_BAD_ARGS;
    }
    
    // Search for volume, library, and file in JSON
    json_parser_t parser = {json, 0, fsize};
    int found = 0;
    
    // Find volume
    char search_key[256];
    snprintf(search_key, sizeof(search_key), "\"%s\"", volume);
    if (!strstr(json, search_key)) {
        free(json);
        return DSERR_NOT_FOUND;
    }
    
    // Find library under volume
    snprintf(search_key, sizeof(search_key), "\"%s\"", library);
    if (!strstr(json, search_key)) {
        free(json);
        return DSERR_NOT_FOUND;
    }
    
    // Find file entry
    snprintf(search_key, sizeof(search_key), "\"%s\"", filename);
    char* file_pos = strstr(json, search_key);
    if (!file_pos) {
        free(json);
        return DSERR_NOT_FOUND;
    }
    
    // Parse file properties
    parser.pos = file_pos - json;
    
    // Look for TYPE: DATASET
    char* type_pos = strstr(file_pos, "\"TYPE\"");
    if (type_pos) {
        char* dataset_pos = strstr(type_pos, "\"DATASET\"");
        if (!dataset_pos || (dataset_pos - type_pos) > 50) {
            free(json);
            return DSERR_NOT_FOUND;
        }
    }
    
    // Extract RECTYPE (mapped to recfm)
    char* rectype_pos = strstr(file_pos, "\"RECTYPE\"");
    if (rectype_pos) {
        parser.pos = rectype_pos - json + 9; // skip "RECTYPE"
        find_char(&parser, ':');
        parser.pos++;
        extract_string(&parser, recfm_out, 4);
    }
    
    // Extract RECLEN (mapped to lrecl)
    char* reclen_pos = strstr(file_pos, "\"RECLEN\"");
    if (reclen_pos) {
        parser.pos = reclen_pos - json + 8; // skip "RECLEN"
        find_char(&parser, ':');
        parser.pos++;
        *lrecl_out = extract_number(&parser);
    }
    
    // Set volume
    strcpy(vol_out, volume);
    
    free(json);
    return DSERR_OK;
}

// Wrapper for existing cat_find interface
int cat_find_wrapper(const char* ds, cat_rec_t* out) {
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