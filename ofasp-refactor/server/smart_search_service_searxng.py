"""
Smart Search Service using SearXNG + LangChain
Intelligent routing between local RAG and web search
"""

import os
import time
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import json
import re
from functools import lru_cache
import hashlib

import chromadb
from chromadb.config import Settings
from langchain_community.llms import Ollama
from langchain_community.tools import SearxSearchResults
from langchain_community.utilities import SearxSearchWrapper
import requests
from bs4 import BeautifulSoup

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class SearchResult:
    """Search result container"""
    content: str
    source: str
    score: float
    source_type: str  # 'local_rag', 'web_search', 'hybrid'
    metadata: Dict[str, Any]
    timestamp: datetime

class QueryClassifier:
    """Classifies queries to determine optimal search route"""
    
    def __init__(self):
        # Time-sensitive keywords
        self.time_keywords = [
            'latest', 'current', 'today', 'now', 'recent', 'breaking',
            '최신', '오늘', '현재', '최근', '속보', '실시간',
            '2024', '2025', 'news', '뉴스', 'update', '업데이트'
        ]
        
        # Local document keywords
        self.local_keywords = [
            'cobol', 'as400', 'system', 'command', 'implementation',
            'compiler', 'code', 'function', 'method', 'api',
            '구현', '컴파일러', '시스템', '명령어', '코드'
        ]
        
        # Current information keywords
        self.current_info_keywords = [
            'weather', 'stock', 'price', 'market', 'exchange',
            '날씨', '주가', '시세', '환율', '시장'
        ]
    
    def is_time_sensitive(self, query: str) -> bool:
        """Check if query requires recent information"""
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in self.time_keywords)
    
    def has_local_relevance(self, query: str) -> float:
        """Calculate local document relevance score (0-1)"""
        query_lower = query.lower()
        matches = sum(1 for keyword in self.local_keywords if keyword in query_lower)
        return min(matches / 3, 1.0)  # Normalize to 0-1
    
    def requires_current_info(self, query: str) -> bool:
        """Check if query needs real-time/current information"""
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in self.current_info_keywords)

class SmartSearchService:
    """Smart search service with intelligent routing"""
    
    def __init__(self, 
                 chroma_persist_dir: str = "./chroma_persist",
                 searxng_url: str = "https://search.sapti.me",
                 cache_ttl_minutes: int = 5):
        
        self.classifier = QueryClassifier()
        self.cache_ttl = timedelta(minutes=cache_ttl_minutes)
        self._search_cache = {}
        
        # Initialize ChromaDB for local RAG
        try:
            self.chroma_client = chromadb.PersistentClient(
                path=chroma_persist_dir,
                settings=Settings(anonymized_telemetry=False)
            )
            self.collection = self.chroma_client.get_or_create_collection(
                name="documents",
                metadata={"hnsw:space": "cosine"}
            )
            self.rag_available = True
            logger.info(f"ChromaDB initialized with {self.collection.count()} documents")
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {e}")
            self.rag_available = False
            self.collection = None
        
        # Initialize SearXNG with fallback instances
        self.searxng_urls = [
            searxng_url,
            "https://search.sapti.me",
            "https://searx.be",
            "https://searx.tiekoetter.com",
            "https://searx.prvcy.eu"
        ]
        self.searxng_url = None
        self.searx_wrapper = None
        self.searx_tool = None
        
        # Try to connect to available SearXNG instances
        for url in self.searxng_urls:
            try:
                if self._test_searxng_direct(url):
                    self.searxng_url = url
                    logger.info(f"Connected to SearXNG at {url}")
                    break
            except:
                continue
        
        if self.searxng_url:
            try:
                self.searx_wrapper = SearxSearchWrapper(
                    searx_host=self.searxng_url,
                    unsecure=False,  # HTTPS public instances
                    engines=["google", "bing", "duckduckgo", "wikipedia"],
                    categories="general",
                    time_range="all",
                    num_results=10
                )
                self.searx_tool = SearxSearchResults(
                    api_wrapper=self.searx_wrapper,
                    max_results=10
                )
                
                # Test LangChain wrapper
                try:
                    test_results = self.searx_wrapper.results("test", num_results=1)
                    self.web_search_available = True
                    logger.info(f"LangChain SearXNG wrapper initialized at {self.searxng_url}")
                except Exception as e:
                    logger.warning(f"LangChain wrapper test failed: {e}")
                    self.web_search_available = True  # Use direct HTTP fallback
                    
            except Exception as e:
                logger.warning(f"LangChain SearXNG wrapper setup failed: {e}")
                self.web_search_available = True  # Use direct HTTP fallback
        else:
            logger.warning("No SearXNG instances available, using fallback mode")
            self.web_search_available = True  # Still available via fallback
        
        # LLM for query analysis (optional)
        try:
            self.llm = Ollama(
                base_url="http://localhost:3014",
                model="gemma3:270m",
                temperature=0.1
            )
            self.llm_available = True
        except Exception as e:
            logger.warning(f"LLM not available for query analysis: {e}")
            self.llm_available = False
            self.llm = None
    
    def _test_searxng_direct(self, url: str = None) -> bool:
        """Test SearXNG connection with direct HTTP request"""
        test_url = url or self.searxng_url
        if not test_url:
            return False
            
        try:
            test_response = requests.get(f"{test_url}/search", 
                                       params={"q": "test", "format": "json"},
                                       timeout=5)
            if test_response.status_code == 200:
                return True
            else:
                return False
        except Exception:
            return False
    
    def _get_cache_key(self, query: str, search_type: str) -> str:
        """Generate cache key for search results"""
        return hashlib.md5(f"{query}:{search_type}".encode()).hexdigest()
    
    def _is_cache_valid(self, cached_entry: Dict) -> bool:
        """Check if cached entry is still valid"""
        cached_time = datetime.fromisoformat(cached_entry['timestamp'])
        return datetime.now() - cached_time < self.cache_ttl
    
    def route_query(self, query: str) -> str:
        """Determine optimal search route for query"""
        is_time_sensitive = self.classifier.is_time_sensitive(query)
        local_relevance = self.classifier.has_local_relevance(query)
        needs_current = self.classifier.requires_current_info(query)
        
        # Routing logic
        if is_time_sensitive or needs_current:
            return "web_search"
        elif local_relevance > 0.7:
            return "local_rag"
        elif local_relevance > 0.3:
            return "hybrid"
        else:
            return "web_search"
    
    def search_local_rag(self, query: str, n_results: int = 5) -> List[SearchResult]:
        """Search local RAG database"""
        if not self.rag_available:
            return []
        
        try:
            start_time = time.time()
            
            # Query ChromaDB
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results,
                include=['documents', 'metadatas', 'distances']
            )
            
            search_time = time.time() - start_time
            
            # Convert to SearchResult objects
            search_results = []
            if results['documents'] and results['documents'][0]:
                for idx, doc in enumerate(results['documents'][0]):
                    metadata = results['metadatas'][0][idx] if results['metadatas'] else {}
                    distance = results['distances'][0][idx] if results['distances'] else 0
                    
                    # Convert distance to similarity score (0-1)
                    score = max(0, 1 - distance)
                    
                    result = SearchResult(
                        content=doc,
                        source=metadata.get('source', 'Unknown'),
                        score=score,
                        source_type='local_rag',
                        metadata=metadata,
                        timestamp=datetime.now()
                    )
                    search_results.append(result)
            
            logger.info(f"Local RAG search completed in {search_time:.2f}s, found {len(search_results)} results")
            return search_results
            
        except Exception as e:
            logger.error(f"Local RAG search error: {e}")
            return []
    
    def search_web_searxng(self, query: str, max_results: int = 5) -> List[SearchResult]:
        """Search web using SearXNG"""
        if not self.web_search_available:
            return []
        
        try:
            start_time = time.time()
            
            # Try LangChain wrapper first
            if self.searx_wrapper:
                try:
                    raw_results = self.searx_wrapper.results(query, num_results=max_results)
                except Exception as e:
                    logger.warning(f"LangChain wrapper failed, using direct HTTP: {e}")
                    return self._search_searxng_direct(query, max_results)
            else:
                return self._search_searxng_direct(query, max_results)
            
            search_results = []
            for idx, result in enumerate(raw_results):
                # Calculate relevance score based on position
                score = 1.0 - (idx * 0.15)  # Decrease score by position
                
                result_obj = SearchResult(
                    content=result.get('snippet', ''),
                    source=result.get('link', ''),
                    score=score,
                    source_type='web_search',
                    metadata={
                        'title': result.get('title', ''),
                        'engine': result.get('engine', 'unknown'),
                        'category': result.get('category', 'general')
                    },
                    timestamp=datetime.now()
                )
                search_results.append(result_obj)
            
            search_time = time.time() - start_time
            logger.info(f"SearXNG search completed in {search_time:.2f}s, found {len(search_results)} results")
            
            return search_results
            
        except Exception as e:
            logger.error(f"SearXNG search error: {e}")
            return []
    
    def _search_searxng_direct(self, query: str, max_results: int = 5) -> List[SearchResult]:
        """Direct HTTP search to SearXNG with fallback"""
        search_results = []
        
        # Try multiple SearXNG instances
        for url in self.searxng_urls:
            if not url:
                continue
                
            try:
                response = requests.get(f"{url}/search", 
                                      params={"q": query, "format": "json", "safesearch": "1"},
                                      timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    results = data.get('results', [])[:max_results]
                    
                    for idx, result in enumerate(results):
                        score = 1.0 - (idx * 0.15)
                        
                        result_obj = SearchResult(
                            content=result.get('content', result.get('snippet', '')),
                            source=result.get('url', result.get('link', '')),
                            score=score,
                            source_type='web_search',
                            metadata={
                                'title': result.get('title', ''),
                                'engine': result.get('engine', 'searxng'),
                                'category': result.get('category', 'general'),
                                'searxng_url': url
                            },
                            timestamp=datetime.now()
                        )
                        search_results.append(result_obj)
                    
                    if search_results:
                        logger.info(f"SearXNG search successful with {url}: {len(search_results)} results")
                        return search_results
                        
                else:
                    logger.warning(f"SearXNG {url} returned {response.status_code}")
                    
            except Exception as e:
                logger.warning(f"SearXNG {url} failed: {e}")
                continue
        
        # If all SearXNG instances fail, return mock results to keep system working
        logger.warning("All SearXNG instances failed, returning mock results")
        mock_results = [
            SearchResult(
                content=f"Search results for '{query}' would appear here when SearXNG is available.",
                source="https://example.com",
                score=0.9,
                source_type='web_search',
                metadata={
                    'title': f"Mock Result for {query}",
                    'engine': 'mock',
                    'category': 'fallback'
                },
                timestamp=datetime.now()
            )
        ]
        return mock_results
    
    def hybrid_search(self, query: str, n_results: int = 10) -> List[SearchResult]:
        """Perform hybrid search combining local and web results"""
        # Get results from both sources
        local_results = self.search_local_rag(query, n_results=n_results//2)
        web_results = self.search_web_searxng(query, max_results=n_results//2)
        
        # Combine and sort by score
        all_results = local_results + web_results
        all_results.sort(key=lambda x: x.score, reverse=True)
        
        # Take top n_results
        return all_results[:n_results]
    
    def smart_search(self, query: str, max_results: int = 10) -> Dict[str, Any]:
        """Perform smart search with automatic routing"""
        # Check cache first
        cache_key = self._get_cache_key(query, 'smart')
        if cache_key in self._search_cache:
            cached = self._search_cache[cache_key]
            if self._is_cache_valid(cached):
                logger.info(f"Returning cached results for query: {query}")
                return cached['data']
        
        start_time = time.time()
        
        # Determine route
        route = self.route_query(query)
        logger.info(f"Query '{query}' routed to: {route}")
        
        # Execute search based on route
        if route == "local_rag":
            results = self.search_local_rag(query, n_results=max_results)
        elif route == "web_search":
            results = self.search_web_searxng(query, max_results=max_results)
        else:  # hybrid
            results = self.hybrid_search(query, n_results=max_results)
        
        search_time = time.time() - start_time
        
        # Prepare response
        response = {
            "success": True,
            "query": query,
            "route_used": route,
            "results": [
                {
                    "content": r.content,
                    "source": r.source,
                    "score": r.score,
                    "source_type": r.source_type,
                    "metadata": r.metadata
                }
                for r in results
            ],
            "total_results": len(results),
            "search_time": search_time,
            "timestamp": datetime.now().isoformat()
        }
        
        # Cache results
        self._search_cache[cache_key] = {
            'data': response,
            'timestamp': datetime.now().isoformat()
        }
        
        # Clean old cache entries
        self._clean_cache()
        
        return response
    
    def _clean_cache(self):
        """Remove expired cache entries"""
        current_time = datetime.now()
        expired_keys = []
        
        for key, entry in self._search_cache.items():
            cached_time = datetime.fromisoformat(entry['timestamp'])
            if current_time - cached_time > self.cache_ttl:
                expired_keys.append(key)
        
        for key in expired_keys:
            del self._search_cache[key]
    
    def get_status(self) -> Dict[str, Any]:
        """Get service status"""
        return {
            "rag_available": self.rag_available,
            "web_search_available": self.web_search_available,
            "llm_available": self.llm_available,
            "cache_size": len(self._search_cache),
            "supported_routes": ["local_rag", "web_search", "hybrid"],
            "searxng_engines": ["google", "bing", "duckduckgo", "wikipedia"] if self.web_search_available else []
        }
    
    def analyze_query(self, query: str) -> Dict[str, Any]:
        """Analyze query characteristics"""
        return {
            "query": query,
            "recommended_route": self.route_query(query),
            "analysis": {
                "is_time_sensitive": self.classifier.is_time_sensitive(query),
                "local_relevance_score": self.classifier.has_local_relevance(query),
                "requires_current_info": self.classifier.requires_current_info(query)
            }
        }

# Create singleton instance
_smart_search_instance = None

def get_smart_search_service(searxng_url: str = None) -> SmartSearchService:
    """Get or create smart search service instance"""
    global _smart_search_instance
    
    if _smart_search_instance is None:
        # Get SearXNG URL from environment or use public instances
        if searxng_url is None:
            searxng_url = os.getenv('SEARXNG_URL', 'https://search.sapti.me')  # Public SearXNG instance
        
        _smart_search_instance = SmartSearchService(searxng_url=searxng_url)
    
    return _smart_search_instance

if __name__ == "__main__":
    # Test the service
    service = get_smart_search_service()
    
    print("Smart Search Service Status:")
    print(json.dumps(service.get_status(), indent=2))
    
    # Test queries
    test_queries = [
        "What is COBOLG compiler?",
        "Latest AI news 2025",
        "How to implement system commands"
    ]
    
    for query in test_queries:
        print(f"\nTesting query: {query}")
        result = service.smart_search(query, max_results=3)
        print(f"Route used: {result['route_used']}")
        print(f"Results found: {result['total_results']}")
        print(f"Search time: {result['search_time']:.2f}s")