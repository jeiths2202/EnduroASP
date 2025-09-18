#!/usr/bin/env python3
"""
RAG (Retrieval-Augmented Generation) Service
Efficient document-based chat system for resource-constrained environments
"""

import os
import json
import logging
import hashlib
import re
import threading
from pathlib import Path
from typing import Dict, List, Any, Optional
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    TextLoader, 
    PyPDFLoader, 
    DirectoryLoader,
    UnstructuredMarkdownLoader
)
import time

logger = logging.getLogger(__name__)

class RAGService:
    def __init__(self, 
                 persist_directory: str = "./chromadb",
                 embedding_model: str = "all-MiniLM-L6-v2",
                 use_onnx: bool = True,
                 chunk_size: int = 512,
                 chunk_overlap: int = 50):
        """
        Initialize RAG Service with optimized settings for local deployment
        
        Args:
            persist_directory: ChromaDB storage path
            embedding_model: Sentence transformer model name
            use_onnx: Use ONNX backend for faster inference
            chunk_size: Maximum chunk size in characters
            chunk_overlap: Overlap between chunks
        """
        self.persist_directory = Path(persist_directory)
        self.persist_directory.mkdir(exist_ok=True)
        
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # Initialize search history storage
        self.history_file = self.persist_directory / 'search_history.json'
        self.favorites_file = self.persist_directory / 'favorites.json'
        self._load_search_history()
        self._load_favorites()
        
        # Initialize file monitoring
        self.file_timestamps = {}  # Track file modification times
        self.watch_directories = set()  # Directories to monitor
        self.auto_reindex_enabled = True
        self.monitor_thread = None
        self.monitor_stop_event = threading.Event()
        
        # Initialize caching
        self.search_cache = {}  # Cache for search results
        self.cache_max_size = 100  # Maximum cache entries
        self.cache_ttl = 3600  # Cache TTL in seconds (1 hour)
        self.embedding_cache = {}  # Cache for embeddings
        self.performance_stats = {
            'total_searches': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'avg_search_time': 0.0,
            'total_search_time': 0.0
        }
        
        # Initialize embedding model with ONNX backend for efficiency
        logger.info(f"Loading embedding model: {embedding_model}")
        try:
            if use_onnx:
                # Try ONNX backend first for better performance
                # Use optimized ONNX model for faster inference
                self.embedding_model = SentenceTransformer(
                    embedding_model, 
                    backend='onnx',
                    model_kwargs={"file_name": "model_O2.onnx"},  # Use O2 optimized model
                    trust_remote_code=True
                )
                logger.info("ONNX backend loaded successfully (O2 optimized)")
            else:
                self.embedding_model = SentenceTransformer(embedding_model)
                logger.info("Standard backend loaded")
        except Exception as e:
            logger.warning(f"ONNX backend failed, falling back to standard: {e}")
            self.embedding_model = SentenceTransformer(embedding_model)
        
        # Initialize ChromaDB with persistent storage
        logger.info(f"Initializing ChromaDB at: {self.persist_directory}")
        self.chroma_client = chromadb.PersistentClient(
            path=str(self.persist_directory),
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Get or create collection
        self.collection = self.chroma_client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"}
        )
        
        # Initialize text splitter for smart chunking
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        
        logger.info("RAG Service initialized successfully")
        self._log_collection_stats()
    
    def _log_collection_stats(self):
        """Log current collection statistics"""
        try:
            count = self.collection.count()
            logger.info(f"Collection contains {count} documents")
        except Exception as e:
            logger.warning(f"Could not get collection stats: {e}")
    
    def _generate_doc_id(self, content: str, source: str) -> str:
        """Generate unique document ID based on content and source"""
        combined = f"{source}:{content}"
        return hashlib.md5(combined.encode()).hexdigest()
    
    def load_documents_from_directory(self, directory_path: str, 
                                    file_types: List[str] = None) -> Dict[str, Any]:
        """
        Load and process documents from a directory
        
        Args:
            directory_path: Path to document directory
            file_types: List of file extensions to process
            
        Returns:
            Processing results with statistics
        """
        if file_types is None:
            file_types = ['.txt', '.md', '.pdf', '.json']
        
        directory_path = Path(directory_path)
        if not directory_path.exists():
            raise ValueError(f"Directory not found: {directory_path}")
        
        results = {
            'processed_files': [],
            'failed_files': [],
            'total_chunks': 0,
            'processing_time': 0
        }
        
        start_time = time.time()
        
        # Process each supported file type
        for file_type in file_types:
            pattern = f"**/*{file_type}"
            files = list(directory_path.glob(pattern))
            
            for file_path in files:
                try:
                    logger.info(f"Processing: {file_path}")
                    
                    # Load document based on file type
                    if file_type == '.pdf':
                        loader = PyPDFLoader(str(file_path))
                    elif file_type == '.md':
                        loader = UnstructuredMarkdownLoader(str(file_path))
                    else:  # .txt, .json and others
                        loader = TextLoader(str(file_path), encoding='utf-8')
                    
                    documents = loader.load()
                    
                    # Process each document
                    for doc in documents:
                        chunks_added = self.add_document(
                            content=doc.page_content,
                            source=str(file_path),
                            metadata=doc.metadata
                        )
                        results['total_chunks'] += chunks_added
                    
                    results['processed_files'].append(str(file_path))
                    
                except Exception as e:
                    logger.error(f"Failed to process {file_path}: {e}")
                    results['failed_files'].append({
                        'file': str(file_path),
                        'error': str(e)
                    })
        
        results['processing_time'] = time.time() - start_time
        logger.info(f"Directory processing completed: {results}")
        
        return results
    
    def add_document(self, content: str, source: str, 
                    metadata: Dict[str, Any] = None) -> int:
        """
        Add a document to the vector database
        
        Args:
            content: Document content
            source: Source identifier (file path, URL, etc.)
            metadata: Additional metadata
            
        Returns:
            Number of chunks created
        """
        if not content.strip():
            logger.warning(f"Empty content for source: {source}")
            return 0
        
        # Split content into chunks
        chunks = self.text_splitter.split_text(content)
        
        if not chunks:
            logger.warning(f"No chunks created for source: {source}")
            return 0
        
        # Prepare metadata
        base_metadata = metadata or {}
        base_metadata.update({
            'source': source,
            'chunk_count': len(chunks),
            'added_at': time.time()
        })
        
        # Generate embeddings for all chunks at once (batch processing)
        try:
            embeddings = self.embedding_model.encode(
                chunks, 
                batch_size=32, 
                show_progress_bar=False,
                convert_to_numpy=True
            ).tolist()
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            return 0
        
        # Prepare data for ChromaDB
        ids = []
        metadatas = []
        
        for i, chunk in enumerate(chunks):
            doc_id = self._generate_doc_id(chunk, f"{source}:chunk_{i}")
            chunk_metadata = base_metadata.copy()
            chunk_metadata.update({
                'chunk_index': i,
                'chunk_text': chunk[:200] + "..." if len(chunk) > 200 else chunk
            })
            
            ids.append(doc_id)
            metadatas.append(chunk_metadata)
        
        # Add to ChromaDB
        try:
            self.collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=chunks,
                metadatas=metadatas
            )
            
            logger.info(f"Added {len(chunks)} chunks from {source}")
            return len(chunks)
            
        except Exception as e:
            logger.error(f"Failed to add chunks to database: {e}")
            return 0
    
    def search_documents(self, query: str, n_results: int = 5,
                        min_score: float = 0.0, file_types: List[str] = None,
                        date_range: Dict[str, float] = None, 
                        sort_by: str = 'similarity') -> List[Dict[str, Any]]:
        """
        Search for relevant documents with advanced filtering
        
        Args:
            query: Search query
            n_results: Maximum number of results
            min_score: Minimum similarity score (0-1)
            file_types: List of file extensions to filter ('.txt', '.md', etc.)
            date_range: Dict with 'start' and 'end' timestamps
            sort_by: Sort method ('similarity', 'date', 'source')
            
        Returns:
            List of relevant documents with metadata
        """
        if not query.strip():
            return []
        
        # Start performance tracking
        search_start_time = time.time()
        
        # Generate cache key
        cache_key = self._generate_cache_key(query, n_results, min_score, file_types, date_range, sort_by)
        
        # Check cache first
        cached_result = self._get_cached_search(cache_key)
        if cached_result is not None:
            self.performance_stats['cache_hits'] += 1
            self.performance_stats['total_searches'] += 1
            logger.info(f"Cache hit for query: {query[:50]}...")
            return cached_result
        
        self.performance_stats['cache_misses'] += 1
        
        try:
            # Generate query embedding with caching
            query_embedding = self._get_cached_embedding(query)
            
            # Build where clause for filtering
            where_clause = {}
            if file_types:
                # Filter by file extensions
                file_patterns = []
                for ft in file_types:
                    if not ft.startswith('.'):
                        ft = '.' + ft
                    file_patterns.append({"source": {"$contains": ft}})
                if len(file_patterns) == 1:
                    where_clause.update(file_patterns[0])
                else:
                    where_clause["$or"] = file_patterns
            
            if date_range and isinstance(date_range, dict):
                date_filters = []
                if 'start' in date_range:
                    date_filters.append({"added_at": {"$gte": date_range['start']}})
                if 'end' in date_range:
                    date_filters.append({"added_at": {"$lte": date_range['end']}})
                
                if date_filters:
                    if where_clause:
                        where_clause = {"$and": [where_clause] + date_filters}
                    else:
                        where_clause = {"$and": date_filters} if len(date_filters) > 1 else date_filters[0]
            
            # Search in ChromaDB with filters
            search_params = {
                "query_embeddings": [query_embedding],
                "n_results": min(n_results * 2, 100),  # Get more results for filtering
                "include": ["documents", "metadatas", "distances"]
            }
            
            if where_clause:
                search_params["where"] = where_clause
            
            results = self.collection.query(**search_params)
            
            # Process and filter results
            documents = []
            if results['documents'] and results['documents'][0]:
                for i, (doc, metadata, distance) in enumerate(zip(
                    results['documents'][0],
                    results['metadatas'][0],
                    results['distances'][0]
                )):
                    # Convert distance to similarity score (ChromaDB uses cosine distance)
                    similarity = 1 - distance
                    
                    if similarity >= min_score:
                        doc_data = {
                            'content': doc,
                            'metadata': metadata,
                            'similarity': similarity,
                            'rank': i + 1,
                            'file_type': self._extract_file_type(metadata.get('source', '')),
                            'added_date': metadata.get('added_at', 0)
                        }
                        documents.append(doc_data)
            
            # Apply sorting
            documents = self._sort_documents(documents, sort_by)
            
            # Limit to requested number of results
            documents = documents[:n_results]
            
            # Add to search history
            filter_info = {}
            if file_types:
                filter_info['file_types'] = file_types
            if date_range:
                filter_info['date_range'] = date_range
            if sort_by != 'similarity':
                filter_info['sort_by'] = sort_by
            
            self.add_to_search_history(query, len(documents), filter_info)
            
            # Cache the results
            self._cache_search_result(cache_key, documents)
            
            # Update performance stats
            search_time = time.time() - search_start_time
            self.performance_stats['total_searches'] += 1
            self.performance_stats['total_search_time'] += search_time
            self.performance_stats['avg_search_time'] = (
                self.performance_stats['total_search_time'] / self.performance_stats['total_searches']
            )
            
            logger.info(f"Found {len(documents)} relevant documents for query in {search_time:.3f}s")
            return documents
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
    def get_collection_info(self) -> Dict[str, Any]:
        """Get information about the document collection"""
        try:
            count = self.collection.count()
            
            # Get some sample documents to analyze
            sample_results = self.collection.peek(limit=10)
            
            info = {
                'total_documents': count,
                'collection_name': self.collection.name,
                'persist_directory': str(self.persist_directory),
                'embedding_model': getattr(self.embedding_model, 'model_name', 'all-MiniLM-L6-v2'),
                'chunk_size': self.chunk_size,
                'chunk_overlap': self.chunk_overlap
            }
            
            if sample_results and sample_results.get('metadatas'):
                # Analyze sources
                sources = set()
                for metadata in sample_results['metadatas']:
                    if metadata and 'source' in metadata:
                        sources.add(metadata['source'])
                
                info['sample_sources'] = list(sources)[:5]
                info['estimated_sources'] = len(sources)
            
            return info
            
        except Exception as e:
            logger.error(f"Failed to get collection info: {e}")
            return {
                'error': str(e),
                'total_documents': 0,
                'collection_name': 'unknown'
            }
    
    def clear_collection(self) -> bool:
        """Clear all documents from the collection"""
        try:
            # Delete the collection and recreate it
            self.chroma_client.delete_collection(name="documents")
            self.collection = self.chroma_client.get_or_create_collection(
                name="documents",
                metadata={"hnsw:space": "cosine"}
            )
            logger.info("Collection cleared successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to clear collection: {e}")
            return False
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check on RAG service"""
        health = {
            'status': 'healthy',
            'embedding_model_loaded': False,
            'chromadb_accessible': False,
            'collection_accessible': False,
            'issues': []
        }
        
        try:
            # Test embedding model
            test_embedding = self.embedding_model.encode(["test"], show_progress_bar=False)
            health['embedding_model_loaded'] = True
        except Exception as e:
            health['issues'].append(f"Embedding model error: {e}")
            health['status'] = 'degraded'
        
        try:
            # Test ChromaDB connection
            self.chroma_client.heartbeat()
            health['chromadb_accessible'] = True
        except Exception as e:
            health['issues'].append(f"ChromaDB error: {e}")
            health['status'] = 'unhealthy'
        
        try:
            # Test collection access
            self.collection.count()
            health['collection_accessible'] = True
        except Exception as e:
            health['issues'].append(f"Collection error: {e}")
            health['status'] = 'degraded'
        
        return health
    
    def _extract_file_type(self, source_path: str) -> str:
        """Extract file extension from source path"""
        if not source_path:
            return 'unknown'
        path = Path(source_path)
        return path.suffix.lower() if path.suffix else 'unknown'
    
    def _sort_documents(self, documents: List[Dict[str, Any]], sort_by: str) -> List[Dict[str, Any]]:
        """Sort documents by specified criteria with advanced ranking"""
        if not documents:
            return documents
        
        if sort_by == 'similarity':
            return sorted(documents, key=lambda x: x['similarity'], reverse=True)
        elif sort_by == 'date':
            return sorted(documents, key=lambda x: x.get('added_date', 0), reverse=True)
        elif sort_by == 'source':
            return sorted(documents, key=lambda x: x['metadata'].get('source', ''))
        elif sort_by == 'size':
            return sorted(documents, key=lambda x: len(x['content']), reverse=True)
        elif sort_by == 'hybrid':
            # Hybrid ranking: combine similarity, recency, and content quality
            return self._hybrid_ranking(documents)
        elif sort_by == 'relevance':
            # Advanced relevance scoring with multiple factors
            return self._relevance_ranking(documents)
        else:
            # Default to similarity
            return sorted(documents, key=lambda x: x['similarity'], reverse=True)
    
    def _hybrid_ranking(self, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Hybrid ranking combining multiple factors"""
        import math
        
        current_time = time.time()
        max_similarity = max((d['similarity'] for d in documents), default=1.0)
        max_age_days = 365  # Consider documents up to 1 year old as "recent"
        
        for doc in documents:
            # Normalize similarity (0-1)
            sim_score = doc['similarity'] / max_similarity if max_similarity > 0 else 0
            
            # Calculate recency score (0-1, newer is better)
            doc_age_seconds = current_time - doc.get('added_date', current_time)
            doc_age_days = doc_age_seconds / (24 * 3600)
            recency_score = max(0, 1 - (doc_age_days / max_age_days))
            
            # Calculate content quality score based on length and structure
            content_length = len(doc['content'])
            quality_score = min(1.0, content_length / 1000)  # Normalize to 1000 chars
            
            # Check for structured content (bullets, numbers, headings)
            structured_patterns = ['•', '-', '*', '1.', '2.', '#', '##']
            structure_bonus = sum(1 for pattern in structured_patterns if pattern in doc['content'])
            structure_score = min(0.2, structure_bonus * 0.05)
            
            # Combined hybrid score with weights
            hybrid_score = (
                0.5 * sim_score +       # 50% similarity
                0.3 * recency_score +   # 30% recency
                0.15 * quality_score +  # 15% content quality
                0.05 + structure_score  # 5% + structure bonus
            )
            
            doc['hybrid_score'] = hybrid_score
        
        return sorted(documents, key=lambda x: x.get('hybrid_score', 0), reverse=True)
    
    def _relevance_ranking(self, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Advanced relevance ranking with contextual factors"""
        for doc in documents:
            base_similarity = doc['similarity']
            
            # Boost score for documents with higher chunk density (more matched chunks from same source)
            source_chunks = sum(1 for d in documents if d['metadata'].get('source') == doc['metadata'].get('source'))
            density_boost = min(0.1, source_chunks * 0.02)
            
            # Boost score for documents with keywords in metadata
            metadata_boost = 0.0
            source_name = doc['metadata'].get('source', '').lower()
            important_keywords = ['guide', 'tutorial', 'documentation', 'readme', 'manual']
            if any(keyword in source_name for keyword in important_keywords):
                metadata_boost = 0.05
            
            # Calculate position boost (earlier chunks often more important)
            chunk_index = doc['metadata'].get('chunk_index', 0)
            position_boost = max(0, 0.1 - (chunk_index * 0.01))
            
            # File type boost (prefer certain file types)
            file_type_boost = 0.0
            file_ext = doc.get('file_type', '').lower()
            preferred_types = {'.md': 0.05, '.txt': 0.03, '.pdf': 0.02}
            file_type_boost = preferred_types.get(file_ext, 0.0)
            
            relevance_score = base_similarity + density_boost + metadata_boost + position_boost + file_type_boost
            doc['relevance_score'] = min(1.0, relevance_score)  # Cap at 1.0
        
        return sorted(documents, key=lambda x: x.get('relevance_score', 0), reverse=True)
    
    def get_document_preview(self, source_path: str, highlight_terms: List[str] = None) -> Dict[str, Any]:
        """Get full document content with optional highlighting"""
        try:
            source_path = Path(source_path)
            if not source_path.exists():
                return {'error': 'Document not found', 'content': ''}
            
            # Read document content
            try:
                with open(source_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
            except Exception as e:
                return {'error': f'Failed to read document: {e}', 'content': ''}
            
            # Apply highlighting if terms provided
            highlighted_content = content
            if highlight_terms:
                highlighted_content = self._highlight_terms(content, highlight_terms)
            
            # Get document statistics
            stats = self._analyze_document(content)
            
            return {
                'source': str(source_path),
                'content': content,
                'highlighted_content': highlighted_content,
                'stats': stats,
                'file_type': source_path.suffix.lower(),
                'size': len(content),
                'modified_time': source_path.stat().st_mtime if source_path.exists() else None
            }
            
        except Exception as e:
            logger.error(f"Error getting document preview: {e}")
            return {'error': str(e), 'content': ''}
    
    def _highlight_terms(self, content: str, terms: List[str]) -> str:
        """Highlight search terms in content"""
        import re
        
        highlighted = content
        for term in terms:
            if not term.strip():
                continue
            
            # Create case-insensitive regex pattern
            pattern = re.compile(re.escape(term), re.IGNORECASE)
            
            # Replace with highlighted version
            highlighted = pattern.sub(
                lambda m: f"<mark class='rag-highlight'>{m.group()}</mark>",
                highlighted
            )
        
        return highlighted
    
    def _analyze_document(self, content: str) -> Dict[str, Any]:
        """Analyze document content and return statistics"""
        lines = content.split('\n')
        words = content.split()
        
        # Count different content types
        headings = sum(1 for line in lines if line.strip().startswith('#'))
        bullet_points = sum(1 for line in lines if line.strip().startswith(('•', '-', '*')))
        numbered_lists = sum(1 for line in lines if re.match(r'^\s*\d+\.', line.strip()))
        code_blocks = content.count('```')
        
        return {
            'total_chars': len(content),
            'total_words': len(words),
            'total_lines': len(lines),
            'headings': headings,
            'bullet_points': bullet_points,
            'numbered_lists': numbered_lists,
            'code_blocks': code_blocks // 2,  # Divide by 2 for opening/closing pairs
            'avg_words_per_line': len(words) / len(lines) if lines else 0
        }
    
    def _load_search_history(self):
        """Load search history from file"""
        try:
            if self.history_file.exists():
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    self.search_history = json.load(f)
            else:
                self.search_history = []
        except Exception as e:
            logger.warning(f"Failed to load search history: {e}")
            self.search_history = []
    
    def _save_search_history(self):
        """Save search history to file"""
        try:
            with open(self.history_file, 'w', encoding='utf-8') as f:
                json.dump(self.search_history[-50:], f, indent=2, ensure_ascii=False)  # Keep last 50 searches
        except Exception as e:
            logger.error(f"Failed to save search history: {e}")
    
    def _load_favorites(self):
        """Load favorites from file"""
        try:
            if self.favorites_file.exists():
                with open(self.favorites_file, 'r', encoding='utf-8') as f:
                    self.favorites = json.load(f)
            else:
                self.favorites = []
        except Exception as e:
            logger.warning(f"Failed to load favorites: {e}")
            self.favorites = []
    
    def _save_favorites(self):
        """Save favorites to file"""
        try:
            with open(self.favorites_file, 'w', encoding='utf-8') as f:
                json.dump(self.favorites, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save favorites: {e}")
    
    def add_to_search_history(self, query: str, results_count: int = 0, filters: Dict[str, Any] = None):
        """Add search query to history"""
        try:
            search_entry = {
                'query': query,
                'timestamp': time.time(),
                'results_count': results_count,
                'filters': filters or {}
            }
            
            # Remove duplicate if exists
            self.search_history = [h for h in self.search_history if h['query'] != query]
            
            # Add to beginning
            self.search_history.insert(0, search_entry)
            
            # Limit to 50 entries
            self.search_history = self.search_history[:50]
            
            self._save_search_history()
        except Exception as e:
            logger.error(f"Failed to add to search history: {e}")
    
    def get_search_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent search history"""
        return self.search_history[:limit]
    
    def clear_search_history(self) -> bool:
        """Clear all search history"""
        try:
            self.search_history = []
            self._save_search_history()
            return True
        except Exception as e:
            logger.error(f"Failed to clear search history: {e}")
            return False
    
    def add_to_favorites(self, item: Dict[str, Any]) -> bool:
        """Add document or search to favorites"""
        try:
            # Generate unique ID for the favorite
            item_id = hashlib.md5(str(item).encode()).hexdigest()
            
            # Check if already exists
            existing_ids = {fav['id'] for fav in self.favorites}
            if item_id in existing_ids:
                return False  # Already in favorites
            
            favorite_entry = {
                'id': item_id,
                'type': item.get('type', 'document'),  # 'document' or 'search'
                'title': item.get('title', ''),
                'data': item,
                'added_at': time.time()
            }
            
            self.favorites.insert(0, favorite_entry)
            self._save_favorites()
            return True
            
        except Exception as e:
            logger.error(f"Failed to add to favorites: {e}")
            return False
    
    def remove_from_favorites(self, item_id: str) -> bool:
        """Remove item from favorites"""
        try:
            original_count = len(self.favorites)
            self.favorites = [fav for fav in self.favorites if fav['id'] != item_id]
            
            if len(self.favorites) < original_count:
                self._save_favorites()
                return True
            return False
            
        except Exception as e:
            logger.error(f"Failed to remove from favorites: {e}")
            return False
    
    def get_favorites(self, item_type: str = None) -> List[Dict[str, Any]]:
        """Get favorites, optionally filtered by type"""
        try:
            if item_type:
                return [fav for fav in self.favorites if fav.get('type') == item_type]
            return self.favorites
        except Exception as e:
            logger.error(f"Failed to get favorites: {e}")
            return []
    
    def start_file_monitoring(self, directories: List[str] = None):
        """Start monitoring directories for file changes"""
        if directories:
            self.watch_directories.update(Path(d) for d in directories)
        
        if not self.watch_directories:
            logger.warning("No directories to monitor")
            return
        
        if self.monitor_thread and self.monitor_thread.is_alive():
            logger.info("File monitoring already running")
            return
        
        self.monitor_stop_event.clear()
        self.monitor_thread = threading.Thread(target=self._monitor_files, daemon=True)
        self.monitor_thread.start()
        logger.info(f"Started file monitoring for {len(self.watch_directories)} directories")
    
    def stop_file_monitoring(self):
        """Stop file monitoring"""
        if self.monitor_thread and self.monitor_thread.is_alive():
            self.monitor_stop_event.set()
            self.monitor_thread.join(timeout=5)
            logger.info("File monitoring stopped")
    
    def _monitor_files(self):
        """Monitor files for changes (runs in background thread)"""
        check_interval = 30  # Check every 30 seconds
        
        while not self.monitor_stop_event.is_set():
            try:
                self._check_file_changes()
            except Exception as e:
                logger.error(f"Error during file monitoring: {e}")
            
            # Wait for the check interval or until stop event is set
            self.monitor_stop_event.wait(check_interval)
    
    def _check_file_changes(self):
        """Check for file changes and trigger reindexing if needed"""
        changes_detected = []
        
        for directory in self.watch_directories:
            if not directory.exists():
                continue
            
            # Supported file types
            file_patterns = ['**/*.txt', '**/*.md', '**/*.pdf', '**/*.json']
            
            for pattern in file_patterns:
                for file_path in directory.glob(pattern):
                    if not file_path.is_file():
                        continue
                    
                    current_mtime = file_path.stat().st_mtime
                    file_key = str(file_path)
                    
                    # Check if file is new or modified
                    if file_key not in self.file_timestamps:
                        # New file
                        self.file_timestamps[file_key] = current_mtime
                        changes_detected.append({
                            'file': file_key,
                            'type': 'added',
                            'mtime': current_mtime
                        })
                    elif self.file_timestamps[file_key] != current_mtime:
                        # Modified file
                        self.file_timestamps[file_key] = current_mtime
                        changes_detected.append({
                            'file': file_key,
                            'type': 'modified',
                            'mtime': current_mtime
                        })
        
        # Check for deleted files
        existing_files = set()
        for directory in self.watch_directories:
            if directory.exists():
                for pattern in ['**/*.txt', '**/*.md', '**/*.pdf', '**/*.json']:
                    existing_files.update(str(f) for f in directory.glob(pattern) if f.is_file())
        
        for file_key in list(self.file_timestamps.keys()):
            if file_key not in existing_files:
                del self.file_timestamps[file_key]
                changes_detected.append({
                    'file': file_key,
                    'type': 'deleted'
                })
        
        # Process changes
        if changes_detected and self.auto_reindex_enabled:
            self._process_file_changes(changes_detected)
    
    def _process_file_changes(self, changes: List[Dict[str, Any]]):
        """Process detected file changes"""
        logger.info(f"Processing {len(changes)} file changes")
        
        reindex_needed = []
        
        for change in changes:
            file_path = change['file']
            change_type = change['type']
            
            logger.info(f"File {change_type}: {file_path}")
            
            if change_type in ['added', 'modified']:
                # Need to reindex this file
                reindex_needed.append(file_path)
            elif change_type == 'deleted':
                # Remove from vector database
                self._remove_document_from_collection(file_path)
        
        # Reindex modified/added files
        if reindex_needed:
            self._reindex_files(reindex_needed)
    
    def _remove_document_from_collection(self, file_path: str):
        """Remove all chunks of a document from the collection"""
        try:
            # Query for all chunks from this source
            results = self.collection.get(
                where={"source": file_path},
                include=["metadatas"]
            )
            
            if results['ids']:
                self.collection.delete(ids=results['ids'])
                logger.info(f"Removed {len(results['ids'])} chunks for deleted file: {file_path}")
        except Exception as e:
            logger.error(f"Failed to remove document {file_path}: {e}")
    
    def _reindex_files(self, file_paths: List[str]):
        """Reindex specified files"""
        try:
            for file_path in file_paths:
                # Remove existing chunks first
                self._remove_document_from_collection(file_path)
                
                # Add updated content
                try:
                    path = Path(file_path)
                    if path.exists():
                        # Determine loader based on file extension
                        if path.suffix == '.pdf':
                            from langchain_community.document_loaders import PyPDFLoader
                            loader = PyPDFLoader(str(path))
                        elif path.suffix == '.md':
                            from langchain_community.document_loaders import UnstructuredMarkdownLoader
                            loader = UnstructuredMarkdownLoader(str(path))
                        else:
                            from langchain_community.document_loaders import TextLoader
                            loader = TextLoader(str(path), encoding='utf-8')
                        
                        documents = loader.load()
                        for doc in documents:
                            self.add_document(
                                content=doc.page_content,
                                source=str(path),
                                metadata=doc.metadata
                            )
                        
                        logger.info(f"Reindexed file: {file_path}")
                except Exception as e:
                    logger.error(f"Failed to reindex {file_path}: {e}")
        
        except Exception as e:
            logger.error(f"Error during reindexing: {e}")
    
    def add_watch_directory(self, directory_path: str) -> bool:
        """Add directory to monitoring list"""
        try:
            path = Path(directory_path)
            if path.exists() and path.is_dir():
                self.watch_directories.add(path)
                
                # Initialize file timestamps for this directory
                file_patterns = ['**/*.txt', '**/*.md', '**/*.pdf', '**/*.json']
                for pattern in file_patterns:
                    for file_path in path.glob(pattern):
                        if file_path.is_file():
                            self.file_timestamps[str(file_path)] = file_path.stat().st_mtime
                
                logger.info(f"Added directory to monitoring: {directory_path}")
                return True
            else:
                logger.warning(f"Directory does not exist: {directory_path}")
                return False
        except Exception as e:
            logger.error(f"Failed to add watch directory: {e}")
            return False
    
    def remove_watch_directory(self, directory_path: str) -> bool:
        """Remove directory from monitoring list"""
        try:
            path = Path(directory_path)
            if path in self.watch_directories:
                self.watch_directories.remove(path)
                
                # Remove file timestamps for this directory
                to_remove = [f for f in self.file_timestamps.keys() if f.startswith(str(path))]
                for f in to_remove:
                    del self.file_timestamps[f]
                
                logger.info(f"Removed directory from monitoring: {directory_path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to remove watch directory: {e}")
            return False
    
    def get_monitoring_status(self) -> Dict[str, Any]:
        """Get current monitoring status"""
        return {
            'enabled': self.auto_reindex_enabled,
            'running': self.monitor_thread and self.monitor_thread.is_alive(),
            'watched_directories': [str(d) for d in self.watch_directories],
            'tracked_files': len(self.file_timestamps),
            'check_interval': 30
        }
    
    def _generate_cache_key(self, query: str, n_results: int = 5, min_score: float = 0.0,
                           file_types: List[str] = None, date_range: Dict[str, float] = None,
                           sort_by: str = 'similarity') -> str:
        """Generate cache key for search parameters"""
        key_data = {
            'query': query.lower().strip(),
            'n_results': n_results,
            'min_score': min_score,
            'file_types': sorted(file_types) if file_types else None,
            'date_range': date_range,
            'sort_by': sort_by
        }
        key_string = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def _get_cached_search(self, cache_key: str) -> Optional[List[Dict[str, Any]]]:
        """Get cached search result if valid"""
        if cache_key not in self.search_cache:
            return None
        
        cached_entry = self.search_cache[cache_key]
        
        # Check if cache entry is still valid
        if time.time() - cached_entry['timestamp'] > self.cache_ttl:
            del self.search_cache[cache_key]
            return None
        
        return cached_entry['results']
    
    def _cache_search_result(self, cache_key: str, results: List[Dict[str, Any]]):
        """Cache search results"""
        # Clean up old cache entries if cache is full
        if len(self.search_cache) >= self.cache_max_size:
            self._cleanup_cache()
        
        self.search_cache[cache_key] = {
            'results': results,
            'timestamp': time.time()
        }
    
    def _cleanup_cache(self):
        """Remove expired and oldest cache entries"""
        current_time = time.time()
        
        # Remove expired entries first
        expired_keys = []
        for key, entry in self.search_cache.items():
            if current_time - entry['timestamp'] > self.cache_ttl:
                expired_keys.append(key)
        
        for key in expired_keys:
            del self.search_cache[key]
        
        # If still over limit, remove oldest entries
        if len(self.search_cache) >= self.cache_max_size:
            sorted_entries = sorted(
                self.search_cache.items(),
                key=lambda x: x[1]['timestamp']
            )
            # Remove oldest 25% of entries
            remove_count = max(1, len(sorted_entries) // 4)
            for key, _ in sorted_entries[:remove_count]:
                del self.search_cache[key]
    
    def _get_cached_embedding(self, text: str):
        """Get embedding with caching"""
        # Create cache key for embedding
        embedding_key = hashlib.md5(text.encode()).hexdigest()
        
        if embedding_key in self.embedding_cache:
            cached_entry = self.embedding_cache[embedding_key]
            # Check if cache entry is still valid (longer TTL for embeddings)
            if time.time() - cached_entry['timestamp'] < self.cache_ttl * 24:  # 24 hours
                return cached_entry['embedding']
        
        # Generate new embedding
        embedding = self.embedding_model.encode(
            [text], 
            show_progress_bar=False,
            convert_to_numpy=True
        ).tolist()[0]
        
        # Cache the embedding
        if len(self.embedding_cache) >= 1000:  # Limit embedding cache size
            oldest_key = min(self.embedding_cache.keys(), 
                           key=lambda k: self.embedding_cache[k]['timestamp'])
            del self.embedding_cache[oldest_key]
        
        self.embedding_cache[embedding_key] = {
            'embedding': embedding,
            'timestamp': time.time()
        }
        
        return embedding
    
    def clear_cache(self) -> bool:
        """Clear all caches"""
        try:
            self.search_cache.clear()
            self.embedding_cache.clear()
            logger.info("All caches cleared")
            return True
        except Exception as e:
            logger.error(f"Failed to clear cache: {e}")
            return False
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        cache_hit_rate = 0.0
        if self.performance_stats['total_searches'] > 0:
            cache_hit_rate = (
                self.performance_stats['cache_hits'] / 
                self.performance_stats['total_searches']
            ) * 100
        
        return {
            'total_searches': self.performance_stats['total_searches'],
            'cache_hits': self.performance_stats['cache_hits'],
            'cache_misses': self.performance_stats['cache_misses'],
            'cache_hit_rate_percent': round(cache_hit_rate, 2),
            'avg_search_time_seconds': round(self.performance_stats['avg_search_time'], 3),
            'total_search_time_seconds': round(self.performance_stats['total_search_time'], 3),
            'cache_entries': len(self.search_cache),
            'embedding_cache_entries': len(self.embedding_cache)
        }

# Global RAG service instance
rag_service = None

def get_rag_service() -> RAGService:
    """Get or create global RAG service instance"""
    global rag_service
    if rag_service is None:
        # Initialize with optimized settings for local deployment
        persist_dir = os.getenv('RAG_PERSIST_DIR', './chromadb')
        embedding_model = os.getenv('RAG_EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
        use_onnx = os.getenv('RAG_USE_ONNX', 'true').lower() == 'true'
        
        rag_service = RAGService(
            persist_directory=persist_dir,
            embedding_model=embedding_model,
            use_onnx=use_onnx
        )
    return rag_service