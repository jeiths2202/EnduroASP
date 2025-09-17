# ASP Encoding API

Java-based REST API for SJIS to UTF8 encoding conversion, designed to replace complex Python encoding logic with a centralized service.

## Overview

This API provides a clean interface for character encoding conversion, particularly optimized for Japanese text processing in ASP systems.

### Core Function Signature

```java
sjis_to_utf8(
    byte[] inputBuffer,   // Raw input bytes
    byte[] outputBuffer,  // Output buffer (allocated by service)
    int inputLength,      // Input buffer length
    int outputLength,     // Maximum output buffer length
    String encoding,      // Source encoding (e.g., "SHIFT_JIS")
    String layout         // Layout parameter (future use)
)
```

## Quick Start

### 1. Build and Run

```bash
# Build and start the API
./build-and-run.sh start

# Check status
./build-and-run.sh status

# View logs
./build-and-run.sh logs
```

### 2. Test the API

```bash
# Health check
curl http://localhost:8080/api/encoding/health

# Get API information
curl http://localhost:8080/api/encoding/info

# Get supported encodings
curl http://localhost:8080/api/encoding/supported
```

### 3. Simple Text Conversion Test

```bash
curl -X POST http://localhost:8080/api/encoding/convert-text \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World", "encoding": "SHIFT_JIS"}'
```

## API Endpoints

### Main Conversion Endpoint

**POST** `/api/encoding/sjis-to-utf8`

Request body:
```json
{
  "inputBuffer": "base64-encoded-input-bytes",
  "inputLength": 1024,
  "outputLength": 2048,
  "encoding": "SHIFT_JIS",
  "layout": "future-parameter"
}
```

Response:
```json
{
  "success": true,
  "outputBuffer": "base64-encoded-utf8-output",
  "actualOutputLength": 1534,
  "sourceEncoding": "SHIFT_JIS",
  "targetEncoding": "UTF-8",
  "errorMessage": null
}
```

### Other Endpoints

- **POST** `/api/encoding/convert-text` - Simple text conversion for testing
- **GET** `/api/encoding/supported` - List supported encodings
- **GET** `/api/encoding/health` - Health check
- **GET** `/api/encoding/info` - API information

## Supported Encodings

- `SHIFT_JIS` (Default)
- `EUC-JP`
- `ISO-2022-JP`
- `UTF-8`
- `US-ASCII`

## Integration Examples

### Python Integration

```python
import requests
import base64

def call_encoding_api(raw_bytes, encoding="SHIFT_JIS"):
    # Encode bytes to base64
    input_b64 = base64.b64encode(raw_bytes).decode('ascii')
    
    payload = {
        "inputBuffer": input_b64,
        "inputLength": len(raw_bytes),
        "outputLength": len(raw_bytes) * 3,  # UTF-8 can be up to 3x larger
        "encoding": encoding,
        "layout": None
    }
    
    response = requests.post(
        "http://localhost:8080/api/encoding/sjis-to-utf8",
        json=payload
    )
    
    if response.ok:
        result = response.json()
        if result['success']:
            # Decode base64 output
            utf8_bytes = base64.b64decode(result['outputBuffer'])
            return utf8_bytes.decode('utf-8')
    
    return None
```

### React/JavaScript Integration

```javascript
async function convertEncoding(inputBytes, encoding = 'SHIFT_JIS') {
  // Convert bytes to base64
  const inputB64 = btoa(String.fromCharCode(...inputBytes));
  
  const response = await fetch('http://localhost:8080/api/encoding/sjis-to-utf8', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputBuffer: inputB64,
      inputLength: inputBytes.length,
      outputLength: inputBytes.length * 3,
      encoding: encoding,
      layout: null
    })
  });
  
  const result = await response.json();
  if (result.success) {
    // Decode base64 output
    const utf8Bytes = atob(result.outputBuffer);
    return utf8Bytes;
  }
  
  throw new Error(result.errorMessage);
}
```

## Project Structure

```
encoding-api/
├── src/main/java/com/asp/encoding/
│   ├── EncodingApiApplication.java     # Spring Boot main class
│   ├── controller/
│   │   └── EncodingController.java     # REST endpoints
│   ├── service/
│   │   └── EncodingService.java        # Core conversion logic
│   └── model/
│       ├── EncodingRequest.java        # Request DTO
│       └── EncodingResponse.java       # Response DTO
├── src/main/resources/
│   └── application.yml                 # Configuration
├── pom.xml                            # Maven dependencies
├── build-and-run.sh                  # Build and run script
└── README.md                          # This file
```

## Configuration

The API runs on port 8080 by default. Modify `src/main/resources/application.yml` to change settings:

```yaml
server:
  port: 8080  # Change port here

logging:
  level:
    com.asp.encoding: INFO  # Change log level
```

## Development

### Build Only
```bash
./build-and-run.sh build
```

### Manual Run
```bash
java -jar target/encoding-api-1.0.0.jar
```

### Stop Service
```bash
./build-and-run.sh stop
```

## Future Enhancements

- Layout parameter implementation for specific data formatting
- Additional encoding support (EBCDIC, etc.)
- Performance optimization for large buffer processing
- Batch conversion endpoints
- Custom character mapping tables

## Logs

- Console output: `logs/console.log`
- Application logs: `logs/encoding-api.log`
- Access logs via Spring Boot Actuator: `http://localhost:8080/actuator/`