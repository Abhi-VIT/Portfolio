"""
MongoDB client module for the portfolio app.

Connects to MongoDB Atlas and provides helper functions to
retrieve portfolio data.  Uses a SEPARATE database (default:
``portfolio_db``) so existing Atlas databases are never touched.
"""

import os
import logging

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

logger = logging.getLogger(__name__)

_client: MongoClient | None = None


def get_db():
    """Return the MongoDB database handle, or *None* when not configured."""
    global _client
    uri = os.environ.get("MONGODB_URI")
    db_name = os.environ.get("MONGODB_DATABASE", "portfolio_db")
    if not uri:
        logger.debug("MONGODB_URI not set — MongoDB disabled.")
        return None
    if _client is None:
        try:
            _client = MongoClient(uri, serverSelectionTimeoutMS=5000)
            # Force a connection test so we fail fast on bad credentials.
            _client.admin.command("ping")
            logger.info("Connected to MongoDB Atlas (%s).", db_name)
        except (ConnectionFailure, ServerSelectionTimeoutError) as exc:
            logger.error("MongoDB connection failed: %s", exc)
            _client = None
            return None
    return _client[db_name]


def get_portfolio_data() -> dict | None:
    """Return the full portfolio document, or *None* on failure."""
    db = get_db()
    if db is None:
        return None
    try:
        return db.portfolio_data.find_one({}, {"_id": 0})
    except Exception as exc:  # noqa: BLE001
        logger.error("Error fetching portfolio data: %s", exc)
        return None
