import subprocess
import os
import json
from logger import get_logger

class JavaExecutor:
    """
    Execute Java programs for OpenASP SMED system
    """
    
    def __init__(self, config_loader):
        self.config = config_loader
        self.logger = get_logger()
        self.java_class_dir = self.config.get_java_class_dir()
        self.logger.debug(f"Java class directory: {self.java_class_dir}")
    
    def execute_program(self, program_name, user_id, input_data=None):
        """
        Execute Java program with user input data
        
        Args:
            program_name (str): Java program name (e.g., "PGM1")
            user_id (str): User ID who triggered the program
            input_data (dict): Input data from SMED fields
            
        Returns:
            dict: Execution result with status, output, and error info
        """
        self.logger.info(f"Executing Java program: {program_name} for user: {user_id}")
        
        try:
            # Validate Java class directory
            if not os.path.exists(self.java_class_dir):
                error_msg = f"Java class directory not found: {self.java_class_dir}"
                self.logger.error(error_msg)
                return self._create_error_result(error_msg)
            
            # Prepare Java class file path
            java_file = os.path.join(self.java_class_dir, f"{program_name}.java")
            class_file = os.path.join(self.java_class_dir, f"{program_name}.class")
            
            self.logger.debug(f"Java file: {java_file}")
            self.logger.debug(f"Class file: {class_file}")
            
            # Check if Java source or class file exists
            if not os.path.exists(java_file) and not os.path.exists(class_file):
                error_msg = f"Java program not found: {program_name}"
                self.logger.error(error_msg)
                return self._create_error_result(error_msg)
            
            # Compile Java file if source exists and class is older or missing
            if os.path.exists(java_file):
                if (not os.path.exists(class_file) or 
                    os.path.getmtime(java_file) > os.path.getmtime(class_file)):
                    self.logger.info(f"Compiling Java program: {program_name}")
                    compile_result = self._compile_java(java_file)
                    if not compile_result["success"]:
                        return compile_result
            
            # Execute Java program
            execution_result = self._execute_java(program_name, user_id, input_data)
            return execution_result
            
        except Exception as e:
            error_msg = f"Unexpected error executing {program_name}: {str(e)}"
            self.logger.error(error_msg)
            return self._create_error_result(error_msg)
    
    def _compile_java(self, java_file):
        """
        Compile Java source file
        """
        try:
            self.logger.debug(f"Compiling: {java_file}")
            
            # Change to Java class directory for compilation
            original_cwd = os.getcwd()
            os.chdir(self.java_class_dir)
            
            # Run javac command
            compile_command = ["javac", os.path.basename(java_file)]
            self.logger.debug(f"Compile command: {' '.join(compile_command)}")
            
            result = subprocess.run(
                compile_command,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Restore original working directory
            os.chdir(original_cwd)
            
            if result.returncode == 0:
                self.logger.info("Java compilation successful")
                return {"success": True, "message": "Compilation successful"}
            else:
                error_msg = f"Compilation failed: {result.stderr}"
                self.logger.error(error_msg)
                return self._create_error_result(error_msg)
                
        except subprocess.TimeoutExpired:
            error_msg = "Java compilation timeout"
            self.logger.error(error_msg)
            return self._create_error_result(error_msg)
        except Exception as e:
            error_msg = f"Compilation error: {str(e)}"
            self.logger.error(error_msg)
            return self._create_error_result(error_msg)
    
    def _execute_java(self, program_name, user_id, input_data):
        """
        Execute compiled Java program
        """
        try:
            # Prepare input data as JSON string
            input_json = json.dumps({
                "user_id": user_id,
                "program": program_name,
                "fields": input_data or {}
            }, ensure_ascii=False)
            
            self.logger.debug(f"Input data: {input_json}")
            
            # Change to Java class directory for execution
            original_cwd = os.getcwd()
            os.chdir(self.java_class_dir)
            
            # Run java command
            execute_command = ["java", program_name]
            self.logger.debug(f"Execute command: {' '.join(execute_command)}")
            
            result = subprocess.run(
                execute_command,
                input=input_json,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            # Restore original working directory
            os.chdir(original_cwd)
            
            self.logger.info(f"Java program execution completed. Return code: {result.returncode}")
            self.logger.debug(f"Program output: {result.stdout}")
            
            if result.stderr:
                self.logger.warning(f"Program stderr: {result.stderr}")
            
            # Try to parse output as JSON
            try:
                output_data = json.loads(result.stdout) if result.stdout.strip() else {}
            except json.JSONDecodeError:
                output_data = {"raw_output": result.stdout}
            
            return {
                "success": result.returncode == 0,
                "return_code": result.returncode,
                "output": output_data,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "message": "Execution completed"
            }
            
        except subprocess.TimeoutExpired:
            error_msg = f"Java program execution timeout: {program_name}"
            self.logger.error(error_msg)
            return self._create_error_result(error_msg)
        except Exception as e:
            error_msg = f"Execution error: {str(e)}"
            self.logger.error(error_msg)
            return self._create_error_result(error_msg)
    
    def _create_error_result(self, error_message):
        """
        Create standardized error result
        """
        return {
            "success": False,
            "return_code": -1,
            "output": {},
            "stdout": "",
            "stderr": error_message,
            "message": error_message
        }
    
    def list_available_programs(self):
        """
        List available Java programs in the class directory
        """
        try:
            if not os.path.exists(self.java_class_dir):
                return []
            
            programs = []
            for file in os.listdir(self.java_class_dir):
                if file.endswith('.java') or file.endswith('.class'):
                    program_name = file.replace('.java', '').replace('.class', '')
                    if program_name not in programs:
                        programs.append(program_name)
            
            self.logger.debug(f"Available Java programs: {programs}")
            return sorted(programs)
            
        except Exception as e:
            self.logger.error(f"Error listing Java programs: {e}")
            return []
