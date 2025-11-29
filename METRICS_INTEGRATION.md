# Metrics API Integration Guide

Complete curl commands for integrating the metrics API endpoint.

## 📋 Endpoint

**POST** `/api/v1/metrics`

---

## 🧪 Test Cases

### 1. Send Single Metric

```bash
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "perf_web_vitals_inp_needs-improvement",
        "page_path": null,
        "value": 1,
        "tags": {
          "authed": "false",
          "platform": "web",
          "is_low_end_device": true,
          "is_low_end_experience": true,
          "page_key": "",
          "save_data": false,
          "service_worker": "supported",
          "is_perf_metric": true,
          "project_name": "base_account_sdk",
          "version_name": "1.0.0"
        },
        "type": "count"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "processed": 1,
    "stored": 1,
    "skipped": 0
  }
}
```

---

### 2. Send Multiple Metrics

```bash
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "perf_web_vitals_inp_needs-improvement",
        "page_path": "/dashboard",
        "value": 1,
        "tags": {
          "platform": "web",
          "is_low_end_device": false
        },
        "type": "count"
      },
      {
        "metric_name": "perf_web_vitals_cls_needs-improvement",
        "page_path": "/dashboard",
        "value": 1,
        "tags": {
          "platform": "web",
          "is_low_end_device": false
        },
        "type": "count"
      },
      {
        "metric_name": "user_action_click",
        "page_path": "/dashboard",
        "value": 1,
        "tags": {
          "button_id": "submit",
          "platform": "web"
        },
        "type": "count"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "processed": 3,
    "stored": 3,
    "skipped": 0
  }
}
```

---

### 3. Test Duplicate Detection (Within 1 Hour)

**First Call:**
```bash
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "test_metric_duplicate",
        "page_path": "/test",
        "value": 1,
        "tags": {
          "test": "value1",
          "platform": "web"
        },
        "type": "count"
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "processed": 1,
    "stored": 1,
    "skipped": 0
  }
}
```

**Second Call (Same Metric - Should Be Skipped):**
```bash
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "test_metric_duplicate",
        "page_path": "/test",
        "value": 1,
        "tags": {
          "test": "value1",
          "platform": "web"
        },
        "type": "count"
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "processed": 1,
    "stored": 0,
    "skipped": 1
  }
}
```

---

### 4. Mixed New and Duplicate Metrics

```bash
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "metric1",
        "value": 1,
        "tags": {"test": "value1"},
        "type": "count"
      },
      {
        "metric_name": "metric2",
        "value": 2,
        "tags": {"test": "value2"},
        "type": "count"
      },
      {
        "metric_name": "metric1",
        "value": 1,
        "tags": {"test": "value1"},
        "type": "count"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "processed": 3,
    "stored": 2,
    "skipped": 1
  }
}
```

---

### 5. Web Vitals Performance Metric

```bash
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "perf_web_vitals_lcp_needs-improvement",
        "page_path": "/",
        "value": 1,
        "tags": {
          "authed": "true",
          "platform": "web",
          "is_low_end_device": false,
          "is_low_end_experience": false,
          "page_key": "home",
          "save_data": false,
          "service_worker": "supported",
          "is_perf_metric": true,
          "project_name": "monad_micropayments",
          "version_name": "1.0.0"
        },
        "type": "count"
      }
    ]
  }'
```

---

### 6. Metric with Null Page Path

```bash
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "user_session_start",
        "page_path": null,
        "value": 1,
        "tags": {
          "platform": "web",
          "user_type": "authenticated"
        },
        "type": "count"
      }
    ]
  }'
```

---

### 7. Error Case - Missing Required Fields

```bash
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "test_metric"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Validation failed",
    "details": [
      {
        "path": ["metrics", 0, "value"],
        "message": "Required"
      },
      {
        "path": ["metrics", 0, "tags"],
        "message": "Required"
      },
      {
        "path": ["metrics", 0, "type"],
        "message": "Required"
      }
    ]
  }
}
```

---

### 8. Error Case - Empty Metrics Array

```bash
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": []
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Metrics array is required and cannot be empty"
  }
}
```

---

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Metrics Configuration
METRICS_DEDUP_WINDOW_HOURS=1
METRICS_EXTERNAL_API_URL=https://cca-lite.coinbase.com/metrics
METRICS_EXTERNAL_API_ENABLED=true
```

---

## 📝 Integration Examples

### Using Environment Variables

```bash
export API_URL="http://localhost:3000"
export METRICS_ENDPOINT="$API_URL/api/v1/metrics"

curl -X POST $METRICS_ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "test_metric",
        "value": 1,
        "tags": {"test": "value"},
        "type": "count"
      }
    ]
  }'
```

### Using jq for Pretty Response

```bash
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "test_metric",
        "value": 1,
        "tags": {"test": "value"},
        "type": "count"
      }
    ]
  }' | jq
```

### Save Response to File

```bash
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "test_metric",
        "value": 1,
        "tags": {"test": "value"},
        "type": "count"
      }
    ]
  }' > metrics_response.json
```

---

## 🔄 Testing Flow

### Complete Test Sequence

```bash
# 1. Send first metric
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "integration_test",
        "page_path": "/test",
        "value": 1,
        "tags": {"test_id": "001"},
        "type": "count"
      }
    ]
  }'

# 2. Send duplicate (should be skipped)
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "integration_test",
        "page_path": "/test",
        "value": 1,
        "tags": {"test_id": "001"},
        "type": "count"
      }
    ]
  }'

# 3. Send different metric (should be stored)
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "integration_test",
        "page_path": "/test",
        "value": 2,
        "tags": {"test_id": "002"},
        "type": "count"
      }
    ]
  }'
```

---

## 📊 Expected Behavior

| Scenario | processed | stored | skipped |
|----------|-----------|--------|---------|
| First time metric | 1 | 1 | 0 |
| Duplicate (within 1 hour) | 1 | 0 | 1 |
| New metric | 1 | 1 | 0 |
| Mixed (2 new, 1 duplicate) | 3 | 2 | 1 |

---

## 🚨 Notes

1. **Deduplication Window**: Metrics are deduplicated within the last 1 hour (configurable via `METRICS_DEDUP_WINDOW_HOURS`)

2. **Hash Generation**: Deduplication uses SHA256 hash of:
   - `metric_name`
   - `page_path` (or null)
   - `tags` (sorted keys for consistency)
   - `type`
   - `value`

3. **External API**: Only new metrics are sent to external API. If external API fails, metrics are still stored in database.

4. **Error Handling**: Invalid requests return validation errors. External API failures don't fail the request.

5. **Performance**: All database queries are indexed for fast lookups.

---

## ✅ Success Indicators

- `stored > 0` means new metrics were stored
- `skipped > 0` means duplicates were detected and skipped
- `processed = stored + skipped` always

---

## 🔍 Debugging

Check if metrics are stored in database:

```bash
# Using Prisma Studio
npm run prisma:studio

# Or query directly
# SELECT * FROM metrics ORDER BY created_at DESC LIMIT 10;
```

