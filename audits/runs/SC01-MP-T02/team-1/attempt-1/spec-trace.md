# spec-trace.md · SC01-MP-T02 · P02→P03 transition

## Transition flow

```
P02 capture (IDLE)
  → user taps shutter / gallery
  → handleCapture(filePath, size)
  → presign POST /api/file/presign → {upload_url, file_key, image_url}
  → wx.uploadFile to upload_url
  → createQuestion POST /api/wb/questions → {qid}
  → state = UPLOADED
  → setTimeout(300ms)
  → wx.navigateTo('/pages/analyzing/index?imageUrl=X&subject=Y&qid=Z')
P03 analyzing (init → analyzing)
  → onLoad extracts imageUrl + subject
  → _startAnalysis(imageUrl, subject)
  → startAnalyze POST /api/ai/analyze → {taskId}
  → _startPolling(taskId)
```

## State machine

| From state | Event | To state | Action |
|---|---|---|---|
| IDLE | shutter tap / gallery pick | UPLOADING | handleCapture begins |
| UPLOADING | presign success | UPLOADING | uploadPct=20 |
| UPLOADING | wx.uploadFile success | UPLOADING | uploadPct=60 |
| UPLOADING | createQuestion success | UPLOADED | uploadPct=100 |
| UPLOADED | setTimeout 300ms | — | wx.navigateTo P03 |
| UPLOADING | any error | ERROR | errorMsg set |
| IDLE | file > 10MB | ERROR | early return, no upload |

## Trace table

| Element | API / State | Vitest assertion | Line |
|---|---|---|---|
| capture handleCapture | POST /api/file/presign | wx.request mock intercept for presign URL | capture-to-analyzing.spec.ts:39-46 |
| capture handleCapture | POST /api/wb/questions | wx.request mock intercept for questions URL | capture-to-analyzing.spec.ts:48-53 |
| capture → analyzing nav | wx.navigateTo | `expect(navUrl).toContain('/pages/analyzing/index')` | capture-to-analyzing.spec.ts:96 |
| imageUrl param | presignResp.image_url | `expect(imageUrlParam).toBe(...)` | capture-to-analyzing.spec.ts:107-110 |
| subject param | this.data.subject | `expect(navUrl).toContain('subject=math')` | capture-to-analyzing.spec.ts:102 |
| qid param | created.qid | `expect(navUrl).toContain('qid=q-12345')` | capture-to-analyzing.spec.ts:105 |
| UPLOADED state | state machine | `expect(pageInstance.data.state).toBe('UPLOADED')` | capture-to-analyzing.spec.ts:119 |
| ERROR on oversize | size > 10MB | `expect(pageInstance.data.errorMsg).toContain('10MB')` | capture-to-analyzing.spec.ts:131 |
