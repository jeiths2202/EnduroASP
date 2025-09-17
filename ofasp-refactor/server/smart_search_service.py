#!/usr/bin/env python3
"""
Smart Search Service with LangChain + Tavily Integration
Intelligent routing between local RAG and web search
"""

import os
import re
import time
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

from langchain.agents import Tool, initialize_agent, AgentType
from langchain.memory import ConversationBufferMemory
from langchain_community.tools.tavily_search import TavilySearchResults
from tavily import TavilyClient

# Import existing RAG service
try:
    from rag_service import get_rag_service
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class SearchResult:
    """Search result data structure"""
    content: str
    source: str
    score: float
    source_type: str  # 'local_rag', 'web_search', 'hybrid'
    metadata: Dict[str, Any]

class QueryClassifier:
    """Classify queries to determine optimal information source"""
    
    def __init__(self):
        # Time-sensitive keywords
        self.time_keywords = [
            'latest', 'recent', 'current', 'today', 'now', 'breaking', 'news',
            '2024', '2025', 'this year', 'last week', 'yesterday',
            'real-time', 'live', 'update', 'trending'
        ]
        
        # Local content indicators (based on our system)
        self.local_keywords = [
            'cobol', 'cobolg', 'system command', 'as/400', 'aspnet',
            'call', 'ovrdspf', 'sndmsg', 'wrapper script', 'open environment',
            'implementation', 'programming guide'
        ]
        
        # Technical documentation keywords
        self.tech_doc_keywords = [
            'how to', 'implement', 'tutorial', 'guide', 'documentation',
            'api', 'configuration', 'setup', 'installation'
        ]
    
    def is_time_sensitive(self, query: str) -> bool:
        """Check if query requires current/latest information"""
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in self.time_keywords)
    
    def has_local_relevance(self, query: str) -> float:
        """Calculate relevance score for local documents"""
        query_lower = query.lower()
        local_matches = sum(1 for keyword in self.local_keywords if keyword in query_lower)
        tech_matches = sum(1 for keyword in self.tech_doc_keywords if keyword in query_lower)
        
        # Calculate score (0.0 to 1.0)
        total_score = (local_matches * 0.3) + (tech_matches * 0.2)
        return min(total_score, 1.0)
    
    def requires_current_info(self, query: str) -> bool:
        """Check if query explicitly needs current/real-time information"""
        indicators = ['price', 'stock', 'weather', 'news', 'event', 'schedule']
        query_lower = query.lower()
        return any(indicator in query_lower for indicator in indicators)

class SmartSearchService:
    """Intelligent search service combining local RAG and web search"""
    
    def __init__(self, tavily_api_key: Optional[str] = None):
        self.classifier = QueryClassifier()
        self.tavily_api_key = tavily_api_key or os.getenv('TAVILY_API_KEY')
        
        # Initialize RAG service
        if RAG_AVAILABLE:
            try:
                self.rag_service = get_rag_service()
                logger.info("RAG service initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize RAG service: {e}")
                self.rag_service = None
        else:
            self.rag_service = None
            logger.warning("RAG service not available")
        
        # Initialize Tavily client
        if self.tavily_api_key:
            try:
                self.tavily_client = TavilyClient(api_key=self.tavily_api_key)
                logger.info("Tavily client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Tavily client: {e}")
                self.tavily_client = None
        else:
            self.tavily_client = None
            logger.warning("Tavily API key not provided - web search disabled")
        
        # Search cache for performance
        self.search_cache = {}
        self.cache_ttl = 300  # 5 minutes
    
    def route_query(self, query: str) -> str:
        """Determine optimal information source for the query"""
        logger.info(f"Routing query: {query}")
        
        # 1. Check if time-sensitive
        if self.classifier.is_time_sensitive(query):
            logger.info("Route: web_search (time-sensitive)")
            return "web_search"
        
        # 2. Check local relevance
        local_score = self.classifier.has_local_relevance(query)
        logger.info(f"Local relevance score: {local_score}")
        
        if local_score > 0.7:
            logger.info("Route: local_rag (high local relevance)")
            return "local_rag"
        
        # 3. Check if requires current info
        if self.classifier.requires_current_info(query):
            logger.info("Route: web_search (requires current info)")
            return "web_search"
        
        # 4. Use hybrid if moderate local relevance
        if local_score > 0.3:
            logger.info("Route: hybrid (moderate local relevance)")
            return "hybrid"
        
        # 5. Default to web search
        logger.info("Route: web_search (default)")
        return "web_search"
    
    def search_local_rag(self, query: str, n_results: int = 5) -> List[SearchResult]:
        """Search local RAG documents"""
        if not self.rag_service:
            logger.warning("RAG service not available for local search")
            return []
        
        try:
            logger.info(f"Searching local RAG for: {query}")
            results = self.rag_service.search_documents(
                query=query,
                n_results=n_results,
                min_score=0.1
            )
            
            search_results = []
            for result in results:
                search_results.append(SearchResult(
                    content=result.get('content', ''),
                    source=result.get('metadata', {}).get('source', 'local'),
                    score=result.get('similarity', 0.0),
                    source_type='local_rag',
                    metadata=result.get('metadata', {})
                ))
            
            logger.info(f"Found {len(search_results)} local results")
            return search_results
            
        except Exception as e:
            logger.error(f"Local RAG search error: {e}")
            return []
    
    def search_web_tavily(self, query: str, max_results: int = 5) -> List[SearchResult]:
        """Search web using Tavily"""
        if not self.tavily_client:
            logger.warning("Tavily client not available for web search")
            return []
        
        # Check cache first
        cache_key = f"web_{hash(query)}"
        if cache_key in self.search_cache:
            cached_result, timestamp = self.search_cache[cache_key]
            if time.time() - timestamp < self.cache_ttl:
                logger.info("Returning cached web search results")
                return cached_result
        
        try:
            logger.info(f"Searching web via Tavily for: {query}")
            
            # Use Tavily client directly for more control
            response = self.tavily_client.search(
                query=query,
                max_results=max_results,
                search_depth="advanced",
                include_answer=True,
                include_raw_content=False
            )
            
            search_results = []
            
            # Add Tavily's AI-generated answer if available
            if response.get('answer'):
                search_results.append(SearchResult(
                    content=response['answer'],
                    source='Tavily AI Summary',
                    score=1.0,
                    source_type='web_search',
                    metadata={'type': 'ai_summary', 'query': query}
                ))
            
            # Add search results
            for i, result in enumerate(response.get('results', [])):
                search_results.append(SearchResult(
                    content=result.get('content', ''),
                    source=result.get('url', f'web_result_{i}'),
                    score=result.get('score', 0.5),
                    source_type='web_search',
                    metadata={
                        'title': result.get('title', ''),
                        'url': result.get('url', ''),
                        'published_date': result.get('published_date', '')
                    }
                ))
            
            # Cache results
            self.search_cache[cache_key] = (search_results, time.time())
            
            logger.info(f"Found {len(search_results)} web results")
            return search_results
            
        except Exception as e:
            logger.error(f"Web search error: {e}")
            return []
    
    def hybrid_search(self, query: str, n_results: int = 10) -> List[SearchResult]:
        """Perform hybrid search combining local RAG and web search"""
        logger.info(f"Performing hybrid search for: {query}")
        
        all_results = []
        
        # Get local results
        local_results = self.search_local_rag(query, n_results // 2)
        all_results.extend(local_results)
        
        # Get web results
        web_results = self.search_web_tavily(query, n_results // 2)
        all_results.extend(web_results)
        
        # Sort by score and source type preference
        all_results.sort(key=lambda x: (
            x.source_type == 'local_rag',  # Prefer local for better accuracy
            x.score
        ), reverse=True)
        
        return all_results[:n_results]
    
    def smart_search(self, query: str, max_results: int = 10) -> Dict[str, Any]:
        """Main search method with intelligent routing"""
        start_time = time.time()
        
        # Route the query
        route = self.route_query(query)
        
        # Perform search based on route
        if route == "local_rag":
            results = self.search_local_rag(query, max_results)
        elif route == "web_search":
            results = self.search_web_tavily(query, max_results)
        elif route == "hybrid":
            results = self.hybrid_search(query, max_results)
        else:
            results = []
        
        search_time = time.time() - start_time
        
        return {
            'query': query,
            'route_used': route,
            'results': results,
            'total_results': len(results),
            'search_time': search_time,
            'timestamp': datetime.now().isoformat()
        }
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get service status and capabilities"""
        return {
            'rag_available': self.rag_service is not None,
            'web_search_available': self.tavily_client is not None,
            'cache_size': len(self.search_cache),
            'supported_routes': ['local_rag', 'web_search', 'hybrid']
        }

# Global service instance
_smart_search_service = None

def get_smart_search_service(tavily_api_key: Optional[str] = None) -> SmartSearchService:
    """Get or create Smart Search Service instance"""
    global _smart_search_service
    if _smart_search_service is None:
        _smart_search_service = SmartSearchService(tavily_api_key)
    return _smart_search_service

if __name__ == "__main__":
    # Test the service
    service = get_smart_search_service()
    
    # Test queries
    test_queries = [
        "What is COBOLG compiler implementation?",  # Local
        "Latest news about AI developments in 2025",  # Web
        "How to implement system commands in open environment",  # Hybrid
        "Current weather in Seoul"  # Web
    ]
    
    for query in test_queries:
        print(f"\n{'='*60}")
        print(f"Testing: {query}")
        print('='*60)
        
        result = service.smart_search(query, max_results=3)
        print(f"Route used: {result['route_used']}")
        print(f"Results found: {result['total_results']}")
        print(f"Search time: {result['search_time']:.2f}s")
        
        for i, res in enumerate(result['results'][:2], 1):
            print(f"\nResult {i} ({res.source_type}):")
            print(f"Source: {res.source}")
            print(f"Score: {res.score:.3f}")
            print(f"Content: {res.content[:100]}...")