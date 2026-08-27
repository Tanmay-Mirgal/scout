# SCOUT API Documentation

SCOUT provides a modular, RESTful API versioned under `/api/v1`.

In development, a live interactive Swagger/OpenAPI UI is available at:
`http://localhost:4000/docs`

---

## 1. Request/Response Format

All requests and responses use JSON.

### Success Response Envelope

```json
{
  "success": true,
  "data": {} // Contains the returned entity or array
}
```

### Success Response with Pagination

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

### Error Response Envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | INTERNAL_ERROR | CONFLICT",
    "message": "Human readable error description",
    "details": [
      {
        "field": "title",
        "message": "title must be at least 3 characters"
      }
    ]
  }
}
```

---

## 2. Research Sessions Endpoints

### Create a Research Session
* **Method:** `POST`
* **Path:** `/api/v1/research-sessions`
* **Request Body:**
  ```json
  {
    "title": "Renewable storage comparison",
    "query": "Compare the efficiency of lithium-ion vs flow batteries.",
    "description": "Optional background info on grid storage scale."
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": "e44d32a0-47b2-4d0f-b1e1-cd8e734c56ee",
      "title": "Renewable storage comparison",
      "query": "Compare the efficiency of lithium-ion vs flow batteries.",
      "description": "Optional background info on grid storage scale.",
      "status": "DRAFT",
      "createdAt": "2026-08-27T16:35:16.881Z",
      "updatedAt": "2026-08-27T16:35:16.881Z",
      "completedAt": null,
      "userId": "d22f6723-5e93-4a61-9c60-e41bf16e9c99"
    }
  }
  ```

### List Research Sessions
* **Method:** `GET`
* **Path:** `/api/v1/research-sessions`
* **Query Parameters:**
  * `page` (optional, default: `1`): Page index.
  * `limit` (optional, default: `10`): Number of items per page.
  * `status` (optional): Filter by session status (e.g. `DRAFT`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `CANCELLED`).
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "e44d32a0-47b2-4d0f-b1e1-cd8e734c56ee",
        "title": "Renewable storage comparison",
        "query": "Compare the efficiency of lithium-ion vs flow batteries.",
        "status": "DRAFT",
        "createdAt": "2026-08-27T16:35:16.881Z",
        "updatedAt": "2026-08-27T16:35:16.881Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
  ```

### Retrieve a Single Research Session
* **Method:** `GET`
* **Path:** `/api/v1/research-sessions/:id`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "e44d32a0-47b2-4d0f-b1e1-cd8e734c56ee",
      "title": "Renewable storage comparison",
      "query": "Compare the efficiency of lithium-ion vs flow batteries.",
      "status": "DRAFT",
      "createdAt": "2026-08-27T16:35:16.881Z"
    }
  }
  ```

### Update a Research Session
* **Method:** `PATCH`
* **Path:** `/api/v1/research-sessions/:id`
* **Request Body:**
  ```json
  {
    "title": "Updated Storage Title",
    "status": "IN_PROGRESS"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "e44d32a0-47b2-4d0f-b1e1-cd8e734c56ee",
      "title": "Updated Storage Title",
      "status": "IN_PROGRESS",
      "createdAt": "2026-08-27T16:35:16.881Z",
      "updatedAt": "2026-08-27T16:37:05.112Z"
    }
  }
  ```

### Delete a Research Session
* **Method:** `DELETE`
* **Path:** `/api/v1/research-sessions/:id`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Research session deleted successfully"
  }
  ```
