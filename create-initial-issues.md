# 🐛 Initial GitHub Issues Creation Guide

## How to Create Issues

Visit: https://github.com/jeiths2202/EnduroASP/issues/new/choose

## 1. Bug Reports to Create

### Bug #1: EBCDIC JAK Encoding Issue
```
Title: [BUG] EBCDIC conversion fails for JAK encoding with special characters
Labels: bug, ebcdic-conversion, high-priority
Description:
When processing JAK EBCDIC files containing SOSI codes (0x0E/0x0F), the conversion fails for certain Japanese characters like 東京 and 関西. 

**Steps to Reproduce:**
1. Upload JAK EBCDIC file with SOSI codes
2. Set encoding to JAK 
3. Set SOSI handling to SPACE
4. Click Convert

**Expected Behavior:**
Japanese characters should convert correctly to Unicode

**Actual Behavior:**
Characters appear as � or incorrect mappings

**Environment:**
- Service: Python EBCDIC Service (Port 3003)
- File Size: 2KB test file
- Encoding: JAK with SOSI codes

**Error Logs:**
```
JAK EBCDIC DBCS conversion failed for C5EC: No mapping found
```
```

### Bug #2: SMED Mobile Responsiveness
```
Title: [BUG] SMED Map Display positioning issues on mobile devices
Labels: bug, frontend, smed-viewer, mobile
Description:
SMED map fields are misaligned on mobile screens smaller than 768px. The 24x80 grid system doesn't scale properly for mobile devices.

**Steps to Reproduce:**
1. Open SMED Map Viewer on mobile device
2. Display any SMED map (e.g., MAIN001)
3. Observe field positioning

**Expected Behavior:**
SMED fields should maintain relative positioning with responsive scaling

**Actual Behavior:**
Fields overlap and text is cut off

**Environment:**
- Device: Mobile (Android/iOS)
- Screen Size: <768px width
- Service: SMED Map Viewer (Port 3000)
```

### Bug #3: Large File Performance
```
Title: [BUG] Performance degradation with large COBOL files >5000 lines
Labels: bug, performance, cobol-conversion
Description:
COBOL to Java conversion becomes extremely slow for files larger than 5000 lines, sometimes taking >10 minutes.

**Steps to Reproduce:**
1. Upload large COBOL program (>5000 lines)
2. Select Java as target language
3. Start conversion
4. Monitor performance

**Expected Behavior:**
Conversion should complete within 2-3 minutes

**Actual Behavior:**
Takes 10+ minutes, browser may timeout

**Environment:**
- Service: OpenASP Refactor (Port 3005)
- File Size: 8500 lines COBOL program
- Memory: 16GB available
```

## 2. Feature Requests to Create

### Feature #1: Batch COBOL Processing
```
Title: [FEATURE] Add batch processing for multiple COBOL files
Labels: enhancement, cobol-conversion, productivity
Priority: High
Component: OpenASP Refactor (Port 3005)

**Problem:**
Currently, users must convert COBOL files one by one, which is time-consuming for large migration projects.

**Proposed Solution:**
Add a batch upload feature that allows:
- Upload multiple COBOL files at once
- Queue processing with progress tracking
- Download all converted Java files as ZIP
- Parallel processing for faster conversion

**Benefits:**
- Reduce manual effort for large projects
- Improve productivity for migration teams
- Better resource utilization

**Acceptance Criteria:**
- [ ] Upload multiple files (drag & drop)
- [ ] Progress indicator for each file
- [ ] Parallel processing (max 5 concurrent)
- [ ] Error handling for individual files
- [ ] ZIP download of results
```

### Feature #2: Real-time SMED Collaboration
```
Title: [FEATURE] Implement real-time collaboration in SMED editor
Labels: enhancement, smed-editor, collaboration
Priority: Medium
Component: SMED Map Viewer (Port 3000)

**Problem:**
Multiple developers working on SMED maps need to coordinate manually to avoid conflicts.

**Proposed Solution:**
WebSocket-based real-time collaboration:
- Live cursor tracking
- Real-time field updates
- User presence indicators
- Conflict resolution
- Version history

**Benefits:**
- Improved team productivity
- Reduced merge conflicts
- Better coordination

**Acceptance Criteria:**
- [ ] Multi-user editing support
- [ ] Real-time field synchronization
- [ ] User presence indicators
- [ ] Automatic conflict resolution
- [ ] Edit history tracking
```

### Feature #3: Cloud Deployment Templates
```
Title: [FEATURE] Add Docker Compose and Kubernetes deployment templates
Labels: enhancement, devops, deployment
Priority: Medium
Component: DevOps & Infrastructure

**Problem:**
Setting up EnduroASP in production requires manual configuration of multiple services.

**Proposed Solution:**
Provide ready-to-use deployment templates:
- Docker Compose for single-server deployment
- Kubernetes YAML for cluster deployment
- Environment-specific configurations
- Auto-scaling configurations
- Health checks and monitoring

**Benefits:**
- Faster production deployment
- Standardized configurations
- Better scalability

**Acceptance Criteria:**
- [ ] Docker Compose file with all services
- [ ] Kubernetes deployment manifests
- [ ] Environment configuration templates
- [ ] Health check endpoints
- [ ] Monitoring integration
```

## 3. Migration Issues to Create

### Migration #1: COMP-3 Precision
```
Title: [MIGRATION] COBOL COMP-3 packed decimal conversion accuracy
Labels: migration, cobol-conversion, data-precision
Migration Type: COBOL to Java conversion

**Source Code:**
```cobol
01 AMOUNT-FIELD PIC 9(7)V99 COMP-3.
```

**Current Output:**
```java
private BigDecimal amountField;
// Precision handling is inconsistent
```

**Expected Output:**
```java
@Column(precision = 9, scale = 2)
private BigDecimal amountField;
// With proper precision preservation
```

**Issue:**
COBOL COMP-3 fields with implied decimal points are not being converted with correct precision in Java BigDecimal declarations.

**Impact:**
Financial calculations may lose precision, causing data integrity issues.
```

### Migration #2: Complex CL Parameters
```
Title: [MIGRATION] CL command parameter parsing for complex nested structures
Labels: migration, cl-conversion, parser
Migration Type: CL to Shell conversion

**Source Code:**
```cl
CALL PGM(MYPGM) PARM((&VAR1 *CAT &VAR2) (&LIST(1) *CAT &LIST(2)))
```

**Current Output:**
```bash
# Parser fails to handle nested parameter structures
mypgm.sh "error_parsing_parameters"
```

**Expected Output:**
```bash
# Properly parsed nested parameters
VAR_COMBINED="${VAR1}${VAR2}"
LIST_COMBINED="${LIST[0]}${LIST[1]}"
mypgm.sh "$VAR_COMBINED" "$LIST_COMBINED"
```

**Issue:**
CL parser cannot handle complex nested parameter expressions with concatenation operators and array references.
```

## 4. Labels to Create

Navigate to: https://github.com/jeiths2202/EnduroASP/labels

Create these labels:
- `bug` (red) - Something isn't working
- `enhancement` (green) - New feature or request  
- `migration` (blue) - Legacy system conversion issues
- `ebcdic-conversion` (yellow) - EBCDIC character encoding
- `cobol-conversion` (orange) - COBOL to Java conversion
- `cl-conversion` (purple) - CL to Shell conversion
- `frontend` (pink) - React UI components
- `backend` (brown) - Python/Java services
- `smed-viewer` (cyan) - SMED map display
- `dslock-suite` (gray) - File I/O system
- `documentation` (light blue) - Documentation improvements
- `performance` (dark red) - Performance optimizations
- `security` (dark green) - Security-related issues
- `high-priority` (red) - Critical issues
- `mobile` (light green) - Mobile device issues
- `productivity` (gold) - Productivity improvements
- `collaboration` (indigo) - Team collaboration features
- `devops` (navy) - DevOps and deployment
- `data-precision` (maroon) - Data accuracy issues
- `parser` (teal) - Code parsing issues

## 5. Project Board Setup

1. Go to: https://github.com/jeiths2202/EnduroASP/projects
2. Create new project: "EnduroASP Development"
3. Add columns:
   - 📋 **Backlog** - New issues and planned features
   - 🔄 **In Progress** - Currently being worked on
   - 👀 **Review** - Ready for review/testing
   - ✅ **Done** - Completed items

## 6. Milestones to Create

Navigate to: https://github.com/jeiths2202/EnduroASP/milestones

- **v1.1.0 Enhanced Conversion** (Due: March 2025)
  - Description: Improved COBOL/CL conversion accuracy and performance
- **v1.2.0 Collaboration Features** (Due: June 2025)  
  - Description: Real-time collaboration and team productivity features
- **v2.0.0 Cloud Native** (Due: September 2025)
  - Description: Cloud deployment, auto-scaling, and enterprise features