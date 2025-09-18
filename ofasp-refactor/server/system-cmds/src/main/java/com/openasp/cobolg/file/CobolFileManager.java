package com.openasp.cobolg.file;

import com.openasp.cobolg.data.CobolDataType;
import com.openasp.cobolg.data.CobolField;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * COBOL 파일 처리 매니저
 * 순차, 색인, 상대 파일 처리 지원
 */
@Component
public class CobolFileManager {
    
    private final Map<String, CobolFile> openFiles = new ConcurrentHashMap<>();
    private final String baseDirectory;
    
    public CobolFileManager() {
        this.baseDirectory = System.getProperty("cobol.file.directory", "/volume/DISK01");
    }
    
    /**
     * 순차 파일 열기
     */
    public <T> SequentialFile<T> openSequentialFile(
            String fileName, 
            Class<T> recordClass, 
            FileMode mode) {
        
        validateFileName(fileName);
        String fullPath = getFullPath(fileName);
        
        SequentialFile<T> file = new SequentialFile<>(fullPath, recordClass, mode);
        openFiles.put(fileName, file);
        
        return file;
    }
    
    /**
     * 색인 파일 열기
     */
    public <T> IndexedFile<T> openIndexedFile(
            String fileName, 
            Class<T> recordClass, 
            String keyFieldName,
            FileMode mode) {
        
        validateFileName(fileName);
        String fullPath = getFullPath(fileName);
        
        IndexedFile<T> file = new IndexedFile<>(fullPath, recordClass, keyFieldName, mode);
        openFiles.put(fileName, file);
        
        return file;
    }
    
    /**
     * 상대 파일 열기
     */
    public <T> RelativeFile<T> openRelativeFile(
            String fileName, 
            Class<T> recordClass,
            FileMode mode) {
        
        validateFileName(fileName);
        String fullPath = getFullPath(fileName);
        
        RelativeFile<T> file = new RelativeFile<>(fullPath, recordClass, mode);
        openFiles.put(fileName, file);
        
        return file;
    }
    
    /**
     * 파일 닫기
     */
    public void closeFile(String fileName) {
        CobolFile file = openFiles.remove(fileName);
        if (file != null) {
            try {
                file.close();
            } catch (IOException e) {
                throw new CobolFileException("파일 닫기 실패: " + fileName, e);
            }
        }
    }
    
    /**
     * 모든 열린 파일 닫기
     */
    public void closeAllFiles() {
        for (String fileName : new ArrayList<>(openFiles.keySet())) {
            closeFile(fileName);
        }
    }
    
    /**
     * 파일 존재 여부 확인
     */
    public boolean fileExists(String fileName) {
        Path path = Paths.get(getFullPath(fileName));
        return Files.exists(path);
    }
    
    /**
     * 파일 삭제
     */
    public boolean deleteFile(String fileName) {
        try {
            Path path = Paths.get(getFullPath(fileName));
            return Files.deleteIfExists(path);
        } catch (IOException e) {
            throw new CobolFileException("파일 삭제 실패: " + fileName, e);
        }
    }
    
    private void validateFileName(String fileName) {
        if (fileName == null || fileName.trim().isEmpty()) {
            throw new IllegalArgumentException("파일명이 비어있습니다");
        }
        
        // 보안: 경로 조작 방지
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            throw new IllegalArgumentException("유효하지 않은 파일명: " + fileName);
        }
    }
    
    private String getFullPath(String fileName) {
        return baseDirectory + "/" + fileName;
    }
    
    /**
     * 파일 모드 열거형
     */
    public enum FileMode {
        INPUT, OUTPUT, I_O, EXTEND
    }
    
    /**
     * 추상 COBOL 파일 클래스
     */
    public abstract static class CobolFile implements Closeable {
        protected final String fileName;
        protected final Class<?> recordClass;
        protected final FileMode mode;
        protected boolean isOpen = false;
        
        public CobolFile(String fileName, Class<?> recordClass, FileMode mode) {
            this.fileName = fileName;
            this.recordClass = recordClass;
            this.mode = mode;
        }
        
        public abstract void open() throws IOException;
        
        public boolean isOpen() { return isOpen; }
        public String getFileName() { return fileName; }
        public FileMode getMode() { return mode; }
    }
    
    /**
     * 순차 파일 클래스
     */
    public static class SequentialFile<T> extends CobolFile {
        private BufferedReader reader;
        private BufferedWriter writer;
        private final CobolRecordParser<T> parser;
        
        public SequentialFile(String fileName, Class<T> recordClass, FileMode mode) {
            super(fileName, recordClass, mode);
            this.parser = new CobolRecordParser<>(recordClass);
            try {
                open();
            } catch (IOException e) {
                throw new CobolFileException("순차 파일 열기 실패: " + fileName, e);
            }
        }
        
        @Override
        public void open() throws IOException {
            Path path = Paths.get(fileName);
            
            switch (mode) {
                case INPUT:
                    if (!Files.exists(path)) {
                        throw new FileNotFoundException("파일을 찾을 수 없습니다: " + fileName);
                    }
                    reader = Files.newBufferedReader(path);
                    break;
                    
                case OUTPUT:
                    writer = Files.newBufferedWriter(path, 
                        StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                    break;
                    
                case EXTEND:
                    writer = Files.newBufferedWriter(path, 
                        StandardOpenOption.CREATE, StandardOpenOption.APPEND);
                    break;
                    
                case I_O:
                    // I-O 모드는 RandomAccessFile 사용
                    throw new UnsupportedOperationException("순차 파일에서 I-O 모드는 지원되지 않습니다");
                    
                default:
                    throw new IllegalArgumentException("지원되지 않는 파일 모드: " + mode);
            }
            
            isOpen = true;
        }
        
        /**
         * 레코드 읽기
         */
        public T readRecord() throws IOException {
            if (!isOpen || reader == null) {
                throw new IllegalStateException("파일이 읽기 모드로 열려있지 않습니다");
            }
            
            String line = reader.readLine();
            if (line == null) {
                return null; // EOF
            }
            
            return parser.parseRecord(line);
        }
        
        /**
         * 레코드 쓰기
         */
        public void writeRecord(T record) throws IOException {
            if (!isOpen || writer == null) {
                throw new IllegalStateException("파일이 쓰기 모드로 열려있지 않습니다");
            }
            
            String line = parser.formatRecord(record);
            writer.write(line);
            writer.newLine();
        }
        
        /**
         * 버퍼 플러시
         */
        public void flush() throws IOException {
            if (writer != null) {
                writer.flush();
            }
        }
        
        @Override
        public void close() throws IOException {
            if (reader != null) {
                reader.close();
                reader = null;
            }
            if (writer != null) {
                writer.flush();
                writer.close();
                writer = null;
            }
            isOpen = false;
        }
    }
    
    /**
     * 색인 파일 클래스
     */
    public static class IndexedFile<T> extends CobolFile {
        private final String keyFieldName;
        private final Map<String, T> index = new HashMap<>();
        private final List<T> records = new ArrayList<>();
        private final CobolRecordParser<T> parser;
        private boolean indexLoaded = false;
        
        public IndexedFile(String fileName, Class<T> recordClass, String keyFieldName, FileMode mode) {
            super(fileName, recordClass, mode);
            this.keyFieldName = keyFieldName;
            this.parser = new CobolRecordParser<>(recordClass);
            
            try {
                open();
            } catch (IOException e) {
                throw new CobolFileException("색인 파일 열기 실패: " + fileName, e);
            }
        }
        
        @Override
        public void open() throws IOException {
            if (mode == FileMode.INPUT || mode == FileMode.I_O) {
                loadIndex();
            }
            isOpen = true;
        }
        
        /**
         * 인덱스 로드
         */
        private void loadIndex() throws IOException {
            Path path = Paths.get(fileName);
            if (!Files.exists(path)) {
                if (mode == FileMode.INPUT) {
                    throw new FileNotFoundException("파일을 찾을 수 없습니다: " + fileName);
                } else {
                    return; // I-O 모드에서는 파일이 없어도 계속 진행
                }
            }
            
            try (BufferedReader reader = Files.newBufferedReader(path)) {
                String line;
                while ((line = reader.readLine()) != null) {
                    T record = parser.parseRecord(line);
                    String key = extractKey(record);
                    
                    index.put(key, record);
                    records.add(record);
                }
            }
            
            indexLoaded = true;
        }
        
        /**
         * 키로 레코드 읽기 (COBOL READ ... KEY IS ...)
         */
        public T readByKey(String key) {
            if (!indexLoaded) {
                throw new IllegalStateException("인덱스가 로드되지 않았습니다");
            }
            
            return index.get(key);
        }
        
        /**
         * 레코드 쓰기/업데이트
         */
        public void writeRecord(T record) throws IOException {
            String key = extractKey(record);
            
            if (index.containsKey(key)) {
                // 기존 레코드 업데이트
                updateRecord(key, record);
            } else {
                // 새 레코드 추가
                index.put(key, record);
                records.add(record);
            }
        }
        
        /**
         * 레코드 업데이트
         */
        private void updateRecord(String key, T newRecord) {
            T oldRecord = index.get(key);
            if (oldRecord != null) {
                int position = records.indexOf(oldRecord);
                if (position >= 0) {
                    records.set(position, newRecord);
                }
                index.put(key, newRecord);
            }
        }
        
        /**
         * 레코드 삭제
         */
        public boolean deleteRecord(String key) {
            T record = index.remove(key);
            if (record != null) {
                records.remove(record);
                return true;
            }
            return false;
        }
        
        /**
         * 파일에 저장
         */
        public void flush() throws IOException {
            try (BufferedWriter writer = Files.newBufferedWriter(Paths.get(fileName),
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING)) {
                
                for (T record : records) {
                    String line = parser.formatRecord(record);
                    writer.write(line);
                    writer.newLine();
                }
            }
        }
        
        /**
         * 레코드에서 키 추출
         */
        private String extractKey(T record) {
            try {
                return parser.extractFieldValue(record, keyFieldName);
            } catch (Exception e) {
                throw new CobolFileException("키 추출 실패: " + keyFieldName, e);
            }
        }
        
        @Override
        public void close() throws IOException {
            if (isOpen && (mode == FileMode.OUTPUT || mode == FileMode.I_O)) {
                flush();
            }
            isOpen = false;
        }
    }
    
    /**
     * 상대 파일 클래스
     */
    public static class RelativeFile<T> extends CobolFile {
        private final List<T> records = new ArrayList<>();
        private final CobolRecordParser<T> parser;
        
        public RelativeFile(String fileName, Class<T> recordClass, FileMode mode) {
            super(fileName, recordClass, mode);
            this.parser = new CobolRecordParser<>(recordClass);
            
            try {
                open();
            } catch (IOException e) {
                throw new CobolFileException("상대 파일 열기 실패: " + fileName, e);
            }
        }
        
        @Override
        public void open() throws IOException {
            if (mode == FileMode.INPUT || mode == FileMode.I_O) {
                loadRecords();
            }
            isOpen = true;
        }
        
        /**
         * 파일에서 레코드 로드
         */
        private void loadRecords() throws IOException {
            Path path = Paths.get(fileName);
            if (!Files.exists(path)) {
                if (mode == FileMode.INPUT) {
                    throw new FileNotFoundException("파일을 찾을 수 없습니다: " + fileName);
                } else {
                    return;
                }
            }
            
            try (BufferedReader reader = Files.newBufferedReader(path)) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.trim().isEmpty()) {
                        records.add(null); // 빈 레코드
                    } else {
                        records.add(parser.parseRecord(line));
                    }
                }
            }
        }
        
        /**
         * 상대 키로 레코드 읽기 (COBOL의 1부터 시작하는 인덱스)
         */
        public T readByRelativeKey(int relativeKey) {
            if (relativeKey < 1) {
                throw new IllegalArgumentException("상대 키는 1부터 시작해야 합니다: " + relativeKey);
            }
            
            int index = relativeKey - 1; // Java의 0부터 시작하는 인덱스로 변환
            if (index >= records.size()) {
                return null; // 범위 초과
            }
            
            return records.get(index);
        }
        
        /**
         * 상대 키로 레코드 쓰기
         */
        public void writeByRelativeKey(int relativeKey, T record) {
            if (relativeKey < 1) {
                throw new IllegalArgumentException("상대 키는 1부터 시작해야 합니다: " + relativeKey);
            }
            
            int index = relativeKey - 1;
            ensureCapacity(relativeKey);
            records.set(index, record);
        }
        
        /**
         * 용량 확보 (빈 레코드로 채움)
         */
        private void ensureCapacity(int relativeKey) {
            while (records.size() < relativeKey) {
                records.add(null);
            }
        }
        
        /**
         * 파일에 저장
         */
        public void flush() throws IOException {
            try (BufferedWriter writer = Files.newBufferedWriter(Paths.get(fileName),
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING)) {
                
                for (T record : records) {
                    if (record == null) {
                        writer.newLine(); // 빈 레코드
                    } else {
                        String line = parser.formatRecord(record);
                        writer.write(line);
                        writer.newLine();
                    }
                }
            }
        }
        
        @Override
        public void close() throws IOException {
            if (isOpen && (mode == FileMode.OUTPUT || mode == FileMode.I_O)) {
                flush();
            }
            isOpen = false;
        }
    }
}