-- OpenASP Catalog Database Schema
-- PostgreSQL 15+ required for JSONB and advanced features

-- Create database (run as superuser)
-- CREATE DATABASE openasp_catalog;
-- CREATE USER openasp WITH PASSWORD 'your_secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE openasp_catalog TO openasp;

-- Connect to openasp_catalog database before running the rest

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- Volumes table
CREATE TABLE volumes (
    volume_id SERIAL PRIMARY KEY,
    volume_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Libraries table
CREATE TABLE libraries (
    library_id SERIAL PRIMARY KEY,
    volume_id INTEGER REFERENCES volumes(volume_id) ON DELETE CASCADE,
    library_name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(volume_id, library_name)
);

-- Objects table (base table for all object types)
CREATE TABLE objects (
    object_id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries(library_id) ON DELETE CASCADE,
    object_name VARCHAR(255) NOT NULL,
    object_type VARCHAR(20) NOT NULL CHECK (object_type IN ('DATASET', 'PGM', 'MAP', 'JOB', 'COPYBOOK', 'LAYOUT')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(library_id, object_name)
);

-- Dataset-specific attributes
CREATE TABLE dataset_attributes (
    object_id INTEGER PRIMARY KEY REFERENCES objects(object_id) ON DELETE CASCADE,
    rectype VARCHAR(10) DEFAULT 'FB',
    reclen INTEGER DEFAULT 80,
    encoding VARCHAR(50) DEFAULT 'utf-8',
    recfm VARCHAR(10),
    lrecl INTEGER,
    records_count INTEGER,
    conversion_info JSONB
);

-- Program-specific attributes
CREATE TABLE program_attributes (
    object_id INTEGER PRIMARY KEY REFERENCES objects(object_id) ON DELETE CASCADE,
    pgmtype VARCHAR(20) NOT NULL,
    pgmname VARCHAR(255),
    version VARCHAR(20) DEFAULT '1.0',
    classfile VARCHAR(500),
    jarfile VARCHAR(500),
    sourcefile VARCHAR(500),
    shellfile VARCHAR(500),
    main_method BOOLEAN DEFAULT FALSE,
    dependencies TEXT,
    execution_mode VARCHAR(50),
    original_source VARCHAR(500),
    naming_convention VARCHAR(20),
    japanese_support BOOLEAN DEFAULT FALSE,
    asp_ready BOOLEAN DEFAULT TRUE
);

-- Map-specific attributes
CREATE TABLE map_attributes (
    object_id INTEGER PRIMARY KEY REFERENCES objects(object_id) ON DELETE CASCADE,
    maptype VARCHAR(20) DEFAULT 'SMED',
    mapfile VARCHAR(500),
    rows INTEGER DEFAULT 24,
    cols INTEGER DEFAULT 80,
    responsive BOOLEAN DEFAULT FALSE
);

-- Job-specific attributes
CREATE TABLE job_attributes (
    object_id INTEGER PRIMARY KEY REFERENCES objects(object_id) ON DELETE CASCADE,
    jobtype VARCHAR(20) DEFAULT 'BATCH',
    schedule VARCHAR(50) DEFAULT 'MANUAL',
    command VARCHAR(500)
);

-- Copybook-specific attributes
CREATE TABLE copybook_attributes (
    object_id INTEGER PRIMARY KEY REFERENCES objects(object_id) ON DELETE CASCADE,
    copybooktype VARCHAR(20) DEFAULT 'COBOL',
    sourcefile VARCHAR(500),
    encoding VARCHAR(50) DEFAULT 'shift_jis'
);

-- Layout-specific attributes
CREATE TABLE layout_attributes (
    object_id INTEGER PRIMARY KEY REFERENCES objects(object_id) ON DELETE CASCADE,
    recfm VARCHAR(10),
    lrecl VARCHAR(10)
);

-- Generic attributes (for extensibility)
CREATE TABLE object_attributes (
    attribute_id SERIAL PRIMARY KEY,
    object_id INTEGER REFERENCES objects(object_id) ON DELETE CASCADE,
    attribute_key VARCHAR(100) NOT NULL,
    attribute_value TEXT,
    value_type VARCHAR(20) DEFAULT 'string',
    UNIQUE(object_id, attribute_key)
);

-- Audit log table
CREATE TABLE audit_log (
    audit_id SERIAL PRIMARY KEY,
    object_id INTEGER REFERENCES objects(object_id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL,
    user_name VARCHAR(100),
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_objects_type ON objects(object_type);
CREATE INDEX idx_objects_updated ON objects(updated_at DESC);
CREATE INDEX idx_object_attributes_key ON object_attributes(attribute_key);
CREATE INDEX idx_audit_log_object ON audit_log(object_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- Full-text search support
CREATE INDEX idx_objects_search ON objects USING gin(to_tsvector('english', object_name || ' ' || COALESCE(description, '')));

-- Trigram indexes for fuzzy search
CREATE INDEX idx_objects_name_trgm ON objects USING gin(object_name gin_trgm_ops);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_volumes_updated_at BEFORE UPDATE ON volumes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_libraries_updated_at BEFORE UPDATE ON libraries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON objects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Catalog view that mimics the catalog.json structure
CREATE VIEW catalog_view AS
WITH object_details AS (
    SELECT 
        v.volume_name,
        l.library_name,
        o.object_name,
        o.object_type,
        o.description,
        o.created_at,
        o.updated_at,
        -- Dataset attributes
        da.rectype,
        da.reclen,
        da.encoding,
        da.recfm,
        da.lrecl,
        da.records_count,
        da.conversion_info,
        -- Program attributes
        pa.pgmtype,
        pa.pgmname,
        pa.version,
        pa.classfile,
        pa.jarfile,
        pa.sourcefile,
        pa.shellfile,
        pa.main_method,
        pa.dependencies,
        pa.execution_mode,
        pa.original_source,
        pa.naming_convention,
        pa.japanese_support,
        pa.asp_ready,
        -- Map attributes
        ma.maptype,
        ma.mapfile,
        ma.rows,
        ma.cols,
        ma.responsive,
        -- Job attributes
        ja.jobtype,
        ja.schedule,
        ja.command,
        -- Copybook attributes
        ca.copybooktype,
        ca.sourcefile as copybook_sourcefile,
        ca.encoding as copybook_encoding,
        -- Layout attributes
        la.recfm as layout_recfm,
        la.lrecl as layout_lrecl
    FROM objects o
    JOIN libraries l ON o.library_id = l.library_id
    JOIN volumes v ON l.volume_id = v.volume_id
    LEFT JOIN dataset_attributes da ON o.object_id = da.object_id
    LEFT JOIN program_attributes pa ON o.object_id = pa.object_id
    LEFT JOIN map_attributes ma ON o.object_id = ma.object_id
    LEFT JOIN job_attributes ja ON o.object_id = ja.object_id
    LEFT JOIN copybook_attributes ca ON o.object_id = ca.object_id
    LEFT JOIN layout_attributes la ON o.object_id = la.object_id
)
SELECT 
    volume_name,
    library_name,
    object_name,
    jsonb_strip_nulls(
        jsonb_build_object(
            'TYPE', object_type,
            'CREATED', created_at,
            'UPDATED', updated_at,
            'DESCRIPTION', description,
            -- Dataset fields
            'RECTYPE', rectype,
            'RECLEN', reclen,
            'ENCODING', encoding,
            'RECFM', recfm,
            'LRECL', lrecl,
            'RECORDS_COUNT', records_count,
            'CONVERSION', conversion_info,
            -- Program fields
            'PGMTYPE', pgmtype,
            'PGMNAME', pgmname,
            'VERSION', version,
            'CLASSFILE', classfile,
            'JARFILE', jarfile,
            'SOURCEFILE', sourcefile,
            'SHELLFILE', shellfile,
            'MAIN_METHOD', main_method,
            'DEPENDENCIES', dependencies,
            'EXECUTION_MODE', execution_mode,
            'ORIGINAL_SOURCE', original_source,
            'NAMING_CONVENTION', naming_convention,
            'JAPANESE_SUPPORT', japanese_support,
            'ASP_READY', asp_ready,
            -- Map fields
            'MAPTYPE', maptype,
            'MAPFILE', mapfile,
            'ROWS', rows,
            'COLS', cols,
            'RESPONSIVE', responsive,
            -- Job fields
            'JOBTYPE', jobtype,
            'SCHEDULE', schedule,
            'COMMAND', command,
            -- Copybook fields
            'COPYBOOKTYPE', copybooktype,
            'COPYBOOK_SOURCEFILE', copybook_sourcefile,
            'COPYBOOK_ENCODING', copybook_encoding,
            -- Layout fields
            'LAYOUT_RECFM', layout_recfm,
            'LAYOUT_LRECL', layout_lrecl
        )
    ) as attributes
FROM object_details;

-- Hierarchical catalog view (returns complete catalog structure as JSON)
CREATE VIEW catalog_json_view AS
SELECT jsonb_object_agg(
    volume_name,
    volume_data
) as catalog
FROM (
    SELECT 
        volume_name,
        jsonb_object_agg(
            library_name,
            library_data
        ) as volume_data
    FROM (
        SELECT 
            volume_name,
            library_name,
            jsonb_object_agg(
                object_name,
                attributes
            ) as library_data
        FROM catalog_view
        GROUP BY volume_name, library_name
    ) libraries
    GROUP BY volume_name
) volumes;

-- Helper functions for catalog operations
CREATE OR REPLACE FUNCTION get_or_create_volume(p_volume_name VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    v_volume_id INTEGER;
BEGIN
    SELECT volume_id INTO v_volume_id FROM volumes WHERE volume_name = p_volume_name;
    
    IF v_volume_id IS NULL THEN
        INSERT INTO volumes (volume_name) VALUES (p_volume_name)
        RETURNING volume_id INTO v_volume_id;
    END IF;
    
    RETURN v_volume_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_or_create_library(p_volume_name VARCHAR, p_library_name VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    v_volume_id INTEGER;
    v_library_id INTEGER;
BEGIN
    v_volume_id := get_or_create_volume(p_volume_name);
    
    SELECT library_id INTO v_library_id 
    FROM libraries 
    WHERE volume_id = v_volume_id AND library_name = p_library_name;
    
    IF v_library_id IS NULL THEN
        INSERT INTO libraries (volume_id, library_name) 
        VALUES (v_volume_id, p_library_name)
        RETURNING library_id INTO v_library_id;
    END IF;
    
    RETURN v_library_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update or create catalog entry
CREATE OR REPLACE FUNCTION update_catalog_entry(
    p_volume_name VARCHAR,
    p_library_name VARCHAR,
    p_object_name VARCHAR,
    p_object_type VARCHAR,
    p_attributes JSONB
) RETURNS VOID AS $$
DECLARE
    v_library_id INTEGER;
    v_object_id INTEGER;
BEGIN
    v_library_id := get_or_create_library(p_volume_name, p_library_name);
    
    -- Get or create object
    SELECT object_id INTO v_object_id
    FROM objects
    WHERE library_id = v_library_id AND object_name = p_object_name;
    
    IF v_object_id IS NULL THEN
        INSERT INTO objects (library_id, object_name, object_type, description)
        VALUES (v_library_id, p_object_name, p_object_type, p_attributes->>'DESCRIPTION')
        RETURNING object_id INTO v_object_id;
    ELSE
        UPDATE objects 
        SET object_type = p_object_type,
            description = p_attributes->>'DESCRIPTION'
        WHERE object_id = v_object_id;
    END IF;
    
    -- Update type-specific attributes based on object type
    CASE p_object_type
        WHEN 'DATASET' THEN
            INSERT INTO dataset_attributes (object_id, rectype, reclen, encoding)
            VALUES (v_object_id, 
                    COALESCE(p_attributes->>'RECTYPE', 'FB'),
                    COALESCE((p_attributes->>'RECLEN')::INTEGER, 80),
                    COALESCE(p_attributes->>'ENCODING', 'utf-8'))
            ON CONFLICT (object_id) DO UPDATE
            SET rectype = EXCLUDED.rectype,
                reclen = EXCLUDED.reclen,
                encoding = EXCLUDED.encoding;
                
        WHEN 'PGM' THEN
            INSERT INTO program_attributes (object_id, pgmtype, pgmname, version)
            VALUES (v_object_id,
                    p_attributes->>'PGMTYPE',
                    p_attributes->>'PGMNAME',
                    COALESCE(p_attributes->>'VERSION', '1.0'))
            ON CONFLICT (object_id) DO UPDATE
            SET pgmtype = EXCLUDED.pgmtype,
                pgmname = EXCLUDED.pgmname,
                version = EXCLUDED.version;
                
        -- Add other types as needed
    END CASE;
    
    -- Store any additional attributes in generic table
    -- This would require more complex logic to handle all attributes
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO openasp;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO openasp;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO openasp;