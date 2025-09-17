#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COBOL to Java Position-based SMED Converter

This tool converts COBOL programs with DISPLAY/ACCEPT FILE statements
to Java classes supporting position-based SMED rendering with WebSocket support.

Features:
- COBOL AST parsing and analysis
- Position-based map.json generation 
- Java WebSocket class generation
- DESTINATION interactive processing support
- SJIS/UTF-8 encoding conversion handling
- Integration with existing position-based SMED API system
"""

import os
import re
import json
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class CobolField:
    """Represents a COBOL field definition"""
    name: str
    level: int
    pic_clause: str
    value: Optional[str] = None
    row: int = 0
    col: int = 0
    length: int = 0
    field_type: str = "input"  # input, text, display
    parent: Optional[str] = None
    children: List[str] = field(default_factory=list)

@dataclass
class CobolDisplayFile:
    """Represents a COBOL DISPLAY FILE operation"""
    variable_name: str
    fields: List[CobolField]
    destination: Optional[str] = None
    interactive: bool = False

@dataclass 
class CobolAcceptFile:
    """Represents a COBOL ACCEPT FILE operation"""
    variable_name: str
    fields: List[CobolField]
    termination_keys: List[str] = field(default_factory=list)

@dataclass
class PositionField:
    """Position-based field definition for map.json"""
    row: int
    col: int 
    length: int
    field_type: str = "input"
    name: Optional[str] = None  # Optional for debugging

@dataclass
class JavaMethod:
    """Java method definition"""
    name: str
    return_type: str
    parameters: List[str] = field(default_factory=list)
    body: str = ""
    visibility: str = "public"

@dataclass
class JavaClass:
    """Generated Java class"""
    name: str
    package: str
    imports: List[str] = field(default_factory=list)
    fields: List[str] = field(default_factory=list)
    methods: List[JavaMethod] = field(default_factory=list)
    implements: List[str] = field(default_factory=list)

class CobolASTParser:
    """Parses COBOL source code into AST representation"""
    
    def __init__(self):
        self.fields: List[CobolField] = []
        self.display_files: List[CobolDisplayFile] = []
        self.accept_files: List[CobolAcceptFile] = []
        self.working_storage_fields: Dict[str, CobolField] = {}
        
    def parse_cobol_program(self, cobol_source: str) -> Dict[str, Any]:
        """Parse COBOL source code and extract relevant structures"""
        logger.info("Starting COBOL program parsing")
        
        lines = cobol_source.split('\n')
        
        # Parse sections
        self._parse_working_storage(lines)
        self._parse_procedure_division(lines)
        
        return {
            'fields': self.fields,
            'display_files': self.display_files,
            'accept_files': self.accept_files,
            'working_storage': self.working_storage_fields
        }
    
    def _parse_working_storage(self, lines: List[str]):
        """Parse WORKING-STORAGE SECTION"""
        logger.info("Parsing WORKING-STORAGE SECTION")
        
        in_working_storage = False
        current_group = None
        
        for line_num, line in enumerate(lines):
            line = line.strip()
            
            if 'WORKING-STORAGE SECTION' in line:
                in_working_storage = True
                continue
                
            if in_working_storage and ('PROCEDURE DIVISION' in line or 'LINKAGE SECTION' in line):
                in_working_storage = False
                break
                
            if in_working_storage and line and not line.startswith('*'):
                field = self._parse_data_definition(line)
                if field:
                    self.working_storage_fields[field.name] = field
                    self.fields.append(field)
                    
                    # Handle group/record structures
                    if field.level == 1:
                        current_group = field.name
                    elif current_group and field.level > 1:
                        field.parent = current_group
                        if current_group in self.working_storage_fields:
                            self.working_storage_fields[current_group].children.append(field.name)
    
    def _parse_data_definition(self, line: str) -> Optional[CobolField]:
        """Parse a single data definition line"""
        # Pattern: level field-name PIC clause [VALUE clause]
        pattern = r'(\d{2})\s+([A-Z0-9-_]+)(?:\s+PIC\s+([^.\s]+))?(?:\s+VALUE\s+"([^"]*)")?'
        match = re.search(pattern, line)
        
        if match:
            level = int(match.group(1))
            name = match.group(2)
            pic_clause = match.group(3) or ""
            value = match.group(4)
            
            # Calculate field length from PIC clause
            length = self._calculate_pic_length(pic_clause)
            
            field = CobolField(
                name=name,
                level=level,
                pic_clause=pic_clause,
                value=value,
                length=length
            )
            
            logger.debug(f"Parsed field: {name} (level {level}, length {length})")
            return field
            
        return None
    
    def _calculate_pic_length(self, pic_clause: str) -> int:
        """Calculate field length from PIC clause"""
        if not pic_clause:
            return 0
            
        # Handle common PIC patterns
        # X(n) - alphanumeric
        x_match = re.search(r'X\((\d+)\)', pic_clause)
        if x_match:
            return int(x_match.group(1))
            
        # 9(n) - numeric 
        nine_match = re.search(r'9\((\d+)\)', pic_clause)
        if nine_match:
            return int(nine_match.group(1))
            
        # Count X's and 9's
        return len(re.findall(r'[X9]', pic_clause))
    
    def _parse_procedure_division(self, lines: List[str]):
        """Parse PROCEDURE DIVISION for DISPLAY/ACCEPT statements"""
        logger.info("Parsing PROCEDURE DIVISION")
        
        in_procedure = False
        
        for line_num, line in enumerate(lines):
            line = line.strip()
            
            if 'PROCEDURE DIVISION' in line:
                in_procedure = True
                continue
                
            if in_procedure and line and not line.startswith('*'):
                # Parse DISPLAY FILE statements
                display_match = re.search(r'DISPLAY\s+([A-Z0-9-_]+)', line)
                if display_match:
                    var_name = display_match.group(1)
                    display_file = self._create_display_file(var_name, lines, line_num)
                    if display_file:
                        self.display_files.append(display_file)
                
                # Parse ACCEPT FILE statements  
                accept_match = re.search(r'ACCEPT\s+([A-Z0-9-_]+)', line)
                if accept_match:
                    var_name = accept_match.group(1)
                    accept_file = self._create_accept_file(var_name, lines, line_num)
                    if accept_file:
                        self.accept_files.append(accept_file)
    
    def _create_display_file(self, var_name: str, lines: List[str], line_num: int) -> Optional[CobolDisplayFile]:
        """Create DISPLAY FILE object from variable name"""
        if var_name in self.working_storage_fields:
            parent_field = self.working_storage_fields[var_name]
            display_fields = []
            
            # Get all child fields
            for field_name in parent_field.children:
                if field_name in self.working_storage_fields:
                    display_fields.append(self.working_storage_fields[field_name])
            
            # Check for DESTINATION in surrounding lines
            destination = self._find_destination(lines, line_num)
            
            return CobolDisplayFile(
                variable_name=var_name,
                fields=display_fields,
                destination=destination,
                interactive=destination is not None
            )
        
        return None
    
    def _create_accept_file(self, var_name: str, lines: List[str], line_num: int) -> Optional[CobolAcceptFile]:
        """Create ACCEPT FILE object from variable name"""
        if var_name in self.working_storage_fields:
            parent_field = self.working_storage_fields[var_name]
            accept_fields = []
            
            # Get all child fields
            for field_name in parent_field.children:
                if field_name in self.working_storage_fields:
                    field = self.working_storage_fields[field_name]
                    field.field_type = "input"  # ACCEPT fields are input fields
                    accept_fields.append(field)
            
            # Look for termination keys
            term_keys = self._find_termination_keys(lines, line_num)
            
            return CobolAcceptFile(
                variable_name=var_name,
                fields=accept_fields,
                termination_keys=term_keys
            )
        
        return None
    
    def _find_destination(self, lines: List[str], current_line: int) -> Optional[str]:
        """Find DESTINATION specification near DISPLAY statement"""
        # Look in surrounding lines for DESTINATION
        search_range = range(max(0, current_line - 5), min(len(lines), current_line + 5))
        
        for i in search_range:
            line = lines[i].strip()
            dest_match = re.search(r'MOVE\s+"([^"]+)"\s+TO\s+DESTINATION', line)
            if dest_match:
                return dest_match.group(1)
                
        return None
    
    def _find_termination_keys(self, lines: List[str], current_line: int) -> List[str]:
        """Find termination keys for ACCEPT statement"""
        # Default termination keys
        return ["ENTER", "F3", "F12"]

class PositionSmedMapGenerator:
    """Generates position-based map.json from COBOL structures"""
    
    def __init__(self):
        self.current_row = 1
        self.current_col = 1
        
    def generate_position_map(self, display_files: List[CobolDisplayFile], 
                            accept_files: List[CobolAcceptFile]) -> List[PositionField]:
        """Generate position-based field map"""
        logger.info("Generating position-based SMED map")
        
        position_fields = []
        
        # Process DISPLAY files (output fields)
        for display_file in display_files:
            for field in display_file.fields:
                pos_field = self._convert_to_position_field(field, "text")
                position_fields.append(pos_field)
                
        # Process ACCEPT files (input fields)  
        for accept_file in accept_files:
            for field in accept_file.fields:
                pos_field = self._convert_to_position_field(field, "input")
                position_fields.append(pos_field)
        
        logger.info(f"Generated {len(position_fields)} position fields")
        return position_fields
    
    def _convert_to_position_field(self, cobol_field: CobolField, field_type: str) -> PositionField:
        """Convert COBOL field to position field"""
        # Calculate position based on field order and length
        row, col = self._calculate_position(cobol_field)
        
        return PositionField(
            row=row,
            col=col,
            length=cobol_field.length,
            field_type=field_type,
            name=cobol_field.name  # For debugging only
        )
    
    def _calculate_position(self, field: CobolField) -> Tuple[int, int]:
        """Calculate screen position for field"""
        # Simple positioning algorithm - can be enhanced
        row = self.current_row
        col = self.current_col
        
        # Advance position for next field
        self.current_col += field.length + 2  # 2 spaces between fields
        if self.current_col > 70:  # Wrap to next line
            self.current_row += 1
            self.current_col = 1
            
        return row, col

class JavaWebSocketClassGenerator:
    """Generates Java WebSocket classes with position-based SMED support"""
    
    def __init__(self):
        self.base_package = "com.openasp.smed"
        
    def generate_java_class(self, program_name: str, 
                          position_fields: List[PositionField],
                          display_files: List[CobolDisplayFile],
                          accept_files: List[CobolAcceptFile]) -> JavaClass:
        """Generate Java class with WebSocket support"""
        logger.info(f"Generating Java class for program: {program_name}")
        
        class_name = self._to_java_class_name(program_name)
        
        java_class = JavaClass(
            name=class_name,
            package=self.base_package,
            imports=[
                "java.util.*",
                "java.util.concurrent.ConcurrentHashMap",
                "org.springframework.beans.factory.annotation.Autowired",
                "org.springframework.stereotype.Component",
                "com.openasp.common.JSONResponse",
                "com.openasp.encoding.EncodingService",
                "com.openasp.websocket.PositionSmedWebSocketService"
            ]
        )
        
        # Add fields
        java_class.fields.extend([
            "private static final PositionField[] MAP_DEFINITION",
            "private PositionSmedWebSocketService webSocketService",
            "private EncodingService encodingService",
            "private Map<String, String> currentFieldData = new ConcurrentHashMap<>()"
        ])
        
        # Generate map definition
        map_def_method = self._generate_map_definition(position_fields)
        java_class.methods.append(map_def_method)
        
        # Generate display methods
        for display_file in display_files:
            method = self._generate_display_method(display_file, position_fields)
            java_class.methods.append(method)
            
        # Generate accept methods
        for accept_file in accept_files:
            method = self._generate_accept_method(accept_file, position_fields)
            java_class.methods.append(method)
            
        # Generate interactive processing method
        if any(df.interactive for df in display_files):
            interactive_method = self._generate_interactive_method()
            java_class.methods.append(interactive_method)
            
        # Generate encoding conversion methods
        encoding_methods = self._generate_encoding_methods()
        java_class.methods.extend(encoding_methods)
        
        return java_class
    
    def _to_java_class_name(self, program_name: str) -> str:
        """Convert COBOL program name to Java class name"""
        # Convert EMPLOYEE-INQUIRY to EmployeeInquiry
        parts = program_name.replace('-', '_').split('_')
        return ''.join(word.capitalize() for word in parts)
    
    def _generate_map_definition(self, position_fields: List[PositionField]) -> JavaMethod:
        """Generate MAP_DEFINITION static field initialization"""
        map_entries = []
        for field in position_fields:
            map_entries.append(f"new PositionField({field.row}, {field.col}, {field.length})")
        
        map_entries_str = ',\n            '.join(map_entries)
        body = f"""{{
        MAP_DEFINITION = new PositionField[] {{
            {map_entries_str}
        }};
    }}"""
        
        return JavaMethod(
            name="static",  # Static initializer
            return_type="",
            body=body
        )
    
    def _generate_display_method(self, display_file: CobolDisplayFile, 
                                position_fields: List[PositionField]) -> JavaMethod:
        """Generate display method with WebSocket support"""
        method_name = f"display{display_file.variable_name.title()}"
        
        body = f'''
        try {{
            // Prepare field data array matching position order
            String[] fieldData = new String[MAP_DEFINITION.length];
            
            // Set display field values
            {self._generate_field_data_setup(display_file)}
            
            // Convert to UTF-8 if needed
            String[] utf8FieldData = convertToUtf8(fieldData);
            
            // Send position-based SMED display via WebSocket
            Map<String, Object> displayData = new HashMap<>();
            displayData.put("map_name", "{display_file.variable_name}");
            displayData.put("map_data", Arrays.asList(MAP_DEFINITION));
            displayData.put("field_data", Arrays.asList(utf8FieldData));
            displayData.put("terminal_id", getCurrentTerminalId());
            displayData.put("encoding", "utf-8");
            displayData.put("timestamp", new Date().toInstant().toString());
            
            webSocketService.sendPositionSmedDisplay(displayData);
            
            // Handle interactive processing if DESTINATION specified
            {self._generate_destination_handling(display_file)}
            
            logger.info("Display sent for {display_file.variable_name}");
            
        }} catch (Exception e) {{
            logger.error("Error in display method: " + e.getMessage(), e);
            throw new RuntimeException("Display operation failed", e);
        }}
        '''
        
        return JavaMethod(
            name=method_name,
            return_type="void",
            body=body
        )
    
    def _generate_accept_method(self, accept_file: CobolAcceptFile,
                              position_fields: List[PositionField]) -> JavaMethod:
        """Generate accept method with WebSocket input handling"""
        method_name = f"accept{accept_file.variable_name.title()}"
        
        body = f'''
        try {{
            // Setup WebSocket listener for input events  
            String mapName = "{accept_file.variable_name}";
            
            // Subscribe to position SMED updates
            webSocketService.subscribeToPositionUpdates(mapName, (updateData) -> {{
                handlePositionUpdate(updateData);
            }});
            
            // Setup key event handler
            String[] terminationKeysArray = {json.dumps(accept_file.termination_keys)};
            webSocketService.subscribeToKeyEvents(mapName, (keyEvent) -> {{
                return handleKeyEvent(keyEvent, terminationKeysArray);
            }});
            
            // Wait for user input or termination key
            CompletableFuture<Map<String, String>> inputFuture = new CompletableFuture<>();
            
            // Setup termination key handling
            setupTerminationKeys(terminationKeysArray, inputFuture);
            
            // Block until input is complete
            Map<String, String> inputData = inputFuture.get(300, TimeUnit.SECONDS); // 5 minute timeout
            
            // Convert from UTF-8 to SJIS if needed
            Map<String, String> sjisInputData = convertFromUtf8(inputData);
            
            // Update current field data
            currentFieldData.putAll(sjisInputData);
            
            logger.info("Accept completed for {accept_file.variable_name}");
            return sjisInputData;
            
        }} catch (TimeoutException e) {{
            logger.warn("Accept operation timed out for {accept_file.variable_name}");
            throw new RuntimeException("Input timeout", e);
        }} catch (Exception e) {{
            logger.error("Error in accept method: " + e.getMessage(), e);
            throw new RuntimeException("Accept operation failed", e);
        }}
        '''
        
        return JavaMethod(
            name=method_name,
            return_type="Map<String, String>",
            body=body
        )
    
    def _generate_interactive_method(self) -> JavaMethod:
        """Generate interactive processing method for DESTINATION handling"""
        body = '''
        try {
            // Handle interactive DESTINATION processing
            logger.info("Starting interactive processing");
            
            // Setup bidirectional WebSocket communication
            webSocketService.enableInteractiveMode(getCurrentTerminalId());
            
            // Process user interactions until completion
            while (isInteractiveProcessingActive()) {
                // Handle incoming WebSocket events
                processWebSocketEvents();
                
                // Small delay to prevent busy waiting
                Thread.sleep(100);
            }
            
            logger.info("Interactive processing completed");
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.warn("Interactive processing interrupted");
        } catch (Exception e) {
            logger.error("Error in interactive processing: " + e.getMessage(), e);
            throw new RuntimeException("Interactive processing failed", e);
        }
        '''
        
        return JavaMethod(
            name="handleInteractiveProcess",
            return_type="void",
            body=body
        )
    
    def _generate_encoding_methods(self) -> List[JavaMethod]:
        """Generate SJIS/UTF-8 encoding conversion methods"""
        methods = []
        
        # UTF-8 conversion method
        utf8_method = JavaMethod(
            name="convertToUtf8",
            return_type="String[]",
            parameters=["String[] sjisData"],
            body='''
            try {
                String[] utf8Data = new String[sjisData.length];
                for (int i = 0; i < sjisData.length; i++) {
                    if (sjisData[i] != null) {
                        utf8Data[i] = encodingService.convertSjisToUtf8(sjisData[i]);
                    } else {
                        utf8Data[i] = "";
                    }
                }
                return utf8Data;
            } catch (Exception e) {
                logger.error("UTF-8 conversion error: " + e.getMessage(), e);
                return sjisData; // Return original data on error
            }
            '''
        )
        methods.append(utf8_method)
        
        # SJIS conversion method
        sjis_method = JavaMethod(
            name="convertFromUtf8", 
            return_type="Map<String, String>",
            parameters=["Map<String, String> utf8Data"],
            body='''
            try {
                Map<String, String> sjisData = new HashMap<>();
                for (Map.Entry<String, String> entry : utf8Data.entrySet()) {
                    String convertedValue = encodingService.convertUtf8ToSjis(entry.getValue());
                    sjisData.put(entry.getKey(), convertedValue);
                }
                return sjisData;
            } catch (Exception e) {
                logger.error("SJIS conversion error: " + e.getMessage(), e);
                return utf8Data; // Return original data on error
            }
            '''
        )
        methods.append(sjis_method)
        
        return methods
    
    def _generate_field_data_setup(self, display_file: CobolDisplayFile) -> str:
        """Generate field data setup code"""
        setup_lines = []
        for i, field in enumerate(display_file.fields):
            if field.value:
                setup_lines.append(f'fieldData[{i}] = "{field.value}";')
            else:
                setup_lines.append(f'fieldData[{i}] = getCurrentFieldValue("{field.name}");')
        
        setup_lines_str = '\n            '.join(setup_lines)
        return setup_lines_str
    
    def _generate_destination_handling(self, display_file: CobolDisplayFile) -> str:
        """Generate DESTINATION handling code"""
        if display_file.interactive and display_file.destination:
            return f'''
            if ("{display_file.destination}".equals("DISPLAY")) {{
                handleInteractiveProcess();
            }}
            '''
        return "// No interactive processing required"

class CobolToJavaConverter:
    """Main converter class orchestrating the conversion process"""
    
    def __init__(self):
        self.parser = CobolASTParser()
        self.map_generator = PositionSmedMapGenerator()
        self.java_generator = JavaWebSocketClassGenerator()
        
    def convert_cobol_program(self, cobol_source: str, program_name: str) -> Dict[str, Any]:
        """Convert COBOL program to Java with position-based SMED support"""
        logger.info(f"Starting conversion for program: {program_name}")
        
        try:
            # Step 1: Parse COBOL source
            ast_data = self.parser.parse_cobol_program(cobol_source)
            
            # Step 2: Generate position-based map
            position_fields = self.map_generator.generate_position_map(
                ast_data['display_files'], 
                ast_data['accept_files']
            )
            
            # Step 3: Generate map.json
            map_json = self._generate_map_json(position_fields)
            
            # Step 4: Generate Java class
            java_class = self.java_generator.generate_java_class(
                program_name,
                position_fields,
                ast_data['display_files'],
                ast_data['accept_files']
            )
            
            # Step 5: Generate Java source code
            java_source = self._generate_java_source(java_class)
            
            # Step 6: Generate sample data.json
            sample_data = self._generate_sample_data(position_fields)
            
            result = {
                'program_name': program_name,
                'java_class_name': java_class.name,
                'java_source': java_source,
                'map_json': map_json,
                'sample_data_json': sample_data,
                'position_fields_count': len(position_fields),
                'display_files_count': len(ast_data['display_files']),
                'accept_files_count': len(ast_data['accept_files']),
                'conversion_timestamp': datetime.now().isoformat(),
                'ast_data': ast_data  # For debugging
            }
            
            logger.info(f"Conversion completed successfully for {program_name}")
            return result
            
        except Exception as e:
            logger.error(f"Conversion failed for {program_name}: {e}")
            raise
    
    def _generate_map_json(self, position_fields: List[PositionField]) -> str:
        """Generate map.json content"""
        map_data = []
        for field in position_fields:
            map_data.append({
                "row": field.row,
                "col": field.col, 
                "length": field.length
            })
        
        return json.dumps(map_data, indent=2, ensure_ascii=False)
    
    def _generate_java_source(self, java_class: JavaClass) -> str:
        """Generate complete Java source code"""
        imports = '\n'.join(f"import {imp};" for imp in java_class.imports)
        
        fields = '\n    '.join(f"{field};" for field in java_class.fields)
        
        methods = []
        for method in java_class.methods:
            if method.name == "static":
                methods.append(f"    static {method.body}")
            else:
                params = ', '.join(method.parameters)
                methods.append(f"    {method.visibility} {method.return_type} {method.name}({params})"
                              f" {{{method.body}\n    }}")
        
        methods_str = '\n\n'.join(methods)
        
        return f'''package {java_class.package};

{imports}

/**
 * Generated Java class from COBOL program
 * Supports position-based SMED rendering with WebSocket communication
 * Auto-generated on {datetime.now().isoformat()}
 */
@Component
public class {java_class.name} {{

    {fields}

{methods_str}

    // Helper methods
    private String getCurrentTerminalId() {{
        // Get current terminal ID from session or context
        return "TERM001"; // Default terminal ID
    }}
    
    private String getCurrentFieldValue(String fieldName) {{
        return currentFieldData.getOrDefault(fieldName, "");
    }}
    
    private boolean isInteractiveProcessingActive() {{
        // Check if interactive processing should continue
        return webSocketService.isInteractiveMode(getCurrentTerminalId());
    }}
    
    private void processWebSocketEvents() {{
        // Process incoming WebSocket events
        webSocketService.processIncomingEvents(getCurrentTerminalId());
    }}
    
    private void handlePositionUpdate(Map<String, Object> updateData) {{
        // Handle position-based field updates from WebSocket
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> updates = (List<Map<String, Object>>) updateData.get("updates");
        
        for (Map<String, Object> update : updates) {{
            int row = (Integer) update.get("row");
            int col = (Integer) update.get("col");
            String value = (String) update.get("value");
            
            // Find field by position and update value
            updateFieldByPosition(row, col, value);
        }}
    }}
    
    private boolean handleKeyEvent(Map<String, Object> keyEvent, String[] terminationKeys) {{
        String key = (String) keyEvent.get("key");
        
        // Check if it's a termination key
        for (String termKey : terminationKeys) {{
            if (termKey.equals(key)) {{
                return true; // Terminate input
            }}
        }}
        
        return false; // Continue input
    }}
    
    private void setupTerminationKeys(String[] terminationKeys, 
                                    CompletableFuture<Map<String, String>> inputFuture) {{
        // Setup handlers for termination keys
        for (String key : terminationKeys) {{
            webSocketService.onKeyEvent(getCurrentTerminalId(), key, () -> {{
                inputFuture.complete(getCurrentFieldData());
            }});
        }}
    }}
    
    private Map<String, String> getCurrentFieldData() {{
        return new HashMap<>(currentFieldData);
    }}
    
    private void updateFieldByPosition(int row, int col, String value) {{
        // Find field by position in MAP_DEFINITION
        for (int i = 0; i < MAP_DEFINITION.length; i++) {{
            PositionField field = MAP_DEFINITION[i];
            if (field.row == row && field.col == col) {{
                currentFieldData.put("field_" + i, value);
                break;
            }}
        }}
    }}
}}

/**
 * Position field definition for SMED mapping
 */
class PositionField {{
    public final int row;
    public final int col;
    public final int length;
    
    public PositionField(int row, int col, int length) {{
        this.row = row;
        this.col = col; 
        this.length = length;
    }}
}}
'''
    
    def _generate_sample_data(self, position_fields: List[PositionField]) -> str:
        """Generate sample data.json"""
        sample_data = []
        for i, field in enumerate(position_fields):
            if field.field_type == "input":
                sample_data.append("")  # Empty for input fields
            else:
                sample_data.append(f"Sample{i+1}")  # Sample text for display fields
        
        return json.dumps(sample_data, indent=2, ensure_ascii=False)

def main():
    """Command line interface for the converter"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Convert COBOL to Java with Position-based SMED support')
    parser.add_argument('--cobol-file', required=True, help='Path to COBOL source file')
    parser.add_argument('--program-name', help='COBOL program name (auto-detected if not specified)')
    parser.add_argument('--output-dir', default='./output', help='Output directory for generated files')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)
    
    try:
        # Read COBOL source
        with open(args.cobol_file, 'r', encoding='utf-8') as f:
            cobol_source = f.read()
        
        # Determine program name
        program_name = args.program_name
        if not program_name:
            program_name = os.path.splitext(os.path.basename(args.cobol_file))[0]
        
        # Convert
        converter = CobolToJavaConverter()
        result = converter.convert_cobol_program(cobol_source, program_name)
        
        # Write outputs
        base_name = result['java_class_name']
        
        # Java source
        java_file = os.path.join(args.output_dir, f"{base_name}.java")
        with open(java_file, 'w', encoding='utf-8') as f:
            f.write(result['java_source'])
        
        # Map JSON
        map_file = os.path.join(args.output_dir, f"{program_name}.map.json")
        with open(map_file, 'w', encoding='utf-8') as f:
            f.write(result['map_json'])
        
        # Sample data JSON
        data_file = os.path.join(args.output_dir, f"{program_name}.data.json")  
        with open(data_file, 'w', encoding='utf-8') as f:
            f.write(result['sample_data_json'])
        
        # Conversion report
        report_file = os.path.join(args.output_dir, f"{program_name}.conversion_report.json")
        with open(report_file, 'w', encoding='utf-8') as f:
            # Remove AST data from report for cleaner output
            report_data = {k: v for k, v in result.items() if k != 'ast_data'}
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        print(f"Conversion completed successfully!")
        print(f"Generated files:")
        print(f"  Java class: {java_file}")
        print(f"  Map JSON: {map_file}")
        print(f"  Sample data: {data_file}")
        print(f"  Report: {report_file}")
        print(f"Position fields: {result['position_fields_count']}")
        print(f"Display files: {result['display_files_count']}")
        print(f"Accept files: {result['accept_files_count']}")
        
    except Exception as e:
        logger.error(f"Conversion failed: {e}")
        return 1
        
    return 0

if __name__ == '__main__':
    exit(main())