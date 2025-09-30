# Jira Clone REST API Documentation

This document provides comprehensive API documentation for the Jira Clone application, designed specifically for AI agent integration.

## Base URL
- Development: `http://localhost:4000`
- Production: TBD

## Authentication

The API supports API token authentication for AI agents and external integrations. Authentication is optional for basic usage but recommended for production environments.

### API Token Authentication

Include the API token in the Authorization header:

```http
Authorization: Bearer your_api_token_here
```

### Managing API Tokens

#### Create API Token
```http
POST /api/tokens
Content-Type: application/json

{
  "name": "Claude AI Agent",
  "description": "Token for Claude to manage issues",
  "userId": 1,
  "scopes": ["read", "write"],
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "message": "API token created successfully",
  "token": "abc123...",
  "tokenInfo": {
    "id": 1,
    "name": "Claude AI Agent",
    "scopes": ["read", "write"],
    "expiresAt": "2024-12-31T23:59:59Z"
  }
}
```

#### List User's Tokens
```http
GET /api/tokens/user/:userId
```

#### Get Token Details
```http
GET /api/tokens/:id
```

#### Update Token
```http
PUT /api/tokens/:id
Authorization: Bearer your_token

{
  "name": "Updated Token Name",
  "scopes": ["read"]
}
```

#### Revoke Token
```http
POST /api/tokens/:id/revoke
Authorization: Bearer your_token
```

#### Validate Token
```http
GET /api/tokens/validate/:token
```

## Data Models

### User
```typescript
interface User {
  id: number
  email: string
  name: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}
```

### Project
```typescript
interface Project {
  id: number
  name: string
  key: string
  description: string
  leadId: number
  lead?: User
  issues?: Issue[]
  createdAt: Date
  updatedAt: Date
}
```

### Issue
```typescript
interface Issue {
  id: number
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'code_review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  type: 'task' | 'story' | 'bug' | 'epic'
  projectId: number
  project?: Project
  assigneeId?: number
  assignee?: User
  reporterId: number
  reporter?: User
  estimate?: number
  labels: string[]
  position: number
  epicId?: number
  epic?: Issue // Parent epic (if this is not an epic)
  epicIssues?: Issue[] // Child issues (if this is an epic)
  sprintId?: number
  sprint?: Sprint
  createdAt: Date
  updatedAt: Date
}
```

### Subtask
```typescript
interface Subtask {
  id: number
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'code_review' | 'done'
  parentIssueId: number
  assigneeId?: number
  assignee?: User
  estimate?: number
  position: number
  createdAt: Date
  updatedAt: Date
}
```

### Comment
```typescript
interface Comment {
  id: number
  content: string
  issueId: number
  authorId: number
  author: User
  parentId?: number
  isEdited: boolean
  editedAt?: Date
  createdAt: Date
  updatedAt: Date
  replies?: Comment[]
}
```

### TimeLog
```typescript
interface TimeLog {
  id: number
  hours: number
  description?: string
  date: Date
  issueId: number
  userId: number
  user: User
  createdAt: Date
}
```

### Attachment
```typescript
interface Attachment {
  id: number
  filename: string
  originalName: string
  mimeType: string
  size: number
  path: string
  issueId: number
  uploadedById: number
  uploadedBy: User
  createdAt: Date
}
```

### Sprint
```typescript
interface Sprint {
  id: number
  name: string
  goal?: string
  status: 'future' | 'active' | 'completed'
  projectId: number
  startDate?: Date
  endDate?: Date
  position: number
  issues: Issue[]
  createdById: number
  createdAt: Date
  updatedAt: Date
}
```

## API Endpoints

### Users

#### Get All Users
```http
GET /api/users
```
**Response:** Array of User objects

#### Get User by ID
```http
GET /api/users/:id
```
**Parameters:**
- `id` (number): User ID

**Response:** User object

#### Create User
```http
POST /api/users
```
**Body:**
```json
{
  "email": "string",
  "name": "string",
  "password": "string",
  "avatar": "string" // optional
}
```
**Response:** Created User object

#### Update User
```http
PATCH /api/users/:id
```
**Parameters:**
- `id` (number): User ID

**Body:** Partial User object
**Response:** Updated User object

#### Delete User
```http
DELETE /api/users/:id
```
**Parameters:**
- `id` (number): User ID

**Response:** No content (204)

### Projects

#### Get All Projects
```http
GET /api/projects
```
**Response:** Array of Project objects with related lead and issues

#### Get Project by ID
```http
GET /api/projects/:id
```
**Parameters:**
- `id` (number): Project ID

**Response:** Project object with related lead and issues

#### Create Project
```http
POST /api/projects
```
**Body:**
```json
{
  "name": "string",
  "key": "string", // unique project key (e.g., "JC")
  "description": "string",
  "leadId": "number"
}
```
**Response:** Created Project object

#### Update Project
```http
PATCH /api/projects/:id
```
**Parameters:**
- `id` (number): Project ID

**Body:** Partial Project object
**Response:** Updated Project object

#### Delete Project
```http
DELETE /api/projects/:id
```
**Parameters:**
- `id` (number): Project ID

**Response:** No content (204)

### Issues

#### Get All Issues
```http
GET /api/issues
```
**Query Parameters:**
- `projectId` (optional, number): Filter issues by project

**Response:** Array of Issue objects with related project, assignee, and reporter

#### Get Issues by Project
```http
GET /api/issues?projectId=:projectId
```
**Query Parameters:**
- `projectId` (number): Project ID

**Response:** Array of Issue objects ordered by position, then creation date

#### Get Issue by ID
```http
GET /api/issues/:id
```
**Parameters:**
- `id` (number): Issue ID

**Response:** Issue object with related project, assignee, and reporter

#### Create Issue
```http
POST /api/issues
```
**Body:**
```json
{
  "title": "string",
  "description": "string", // optional
  "status": "todo" | "in_progress" | "code_review" | "done",
  "priority": "low" | "medium" | "high" | "urgent",
  "type": "task" | "story" | "bug" | "epic",
  "projectId": "number",
  "assigneeId": "number", // optional
  "reporterId": "number",
  "estimate": "number", // optional
  "labels": ["string"] // optional array
}
```
**Response:** Created Issue object

#### Update Issue
```http
PATCH /api/issues/:id
```
**Parameters:**
- `id` (number): Issue ID

**Body:** Partial Issue object
**Response:** Updated Issue object

#### Reorder Issues
```http
POST /api/issues/reorder
```
**Body:**
```json
[
  {
    "id": "number",
    "position": "number",
    "status": "todo" | "in_progress" | "code_review" | "done"
  }
]
```
**Response:** No content (204)

#### Delete Issue
```http
DELETE /api/issues/:id
```
**Parameters:**
- `id` (number): Issue ID

**Response:** No content (204)

### Subtasks

#### Create Subtask
```http
POST /api/subtasks
```
**Body:**
```json
{
  "title": "string",
  "description": "string", // optional
  "parentIssueId": "number",
  "assigneeId": "number", // optional
  "estimate": "number" // optional
}
```
**Response:** Created Subtask object

#### Get Subtasks by Issue
```http
GET /api/subtasks/issue/:issueId
```
**Parameters:**
- `issueId` (number): Parent issue ID

**Response:** Array of Subtask objects

#### Get Subtask Progress
```http
GET /api/subtasks/issue/:issueId/progress
```
**Parameters:**
- `issueId` (number): Parent issue ID

**Response:**
```json
{
  "completed": "number",
  "total": "number",
  "percentage": "number"
}
```

#### Get Subtask by ID
```http
GET /api/subtasks/:id
```
**Parameters:**
- `id` (number): Subtask ID

**Response:** Subtask object

#### Update Subtask
```http
PATCH /api/subtasks/:id
```
**Parameters:**
- `id` (number): Subtask ID

**Body:** Partial Subtask object
**Response:** Updated Subtask object

#### Reorder Subtasks
```http
POST /api/subtasks/issue/:issueId/reorder
```
**Parameters:**
- `issueId` (number): Parent issue ID

**Body:**
```json
{
  "subtaskIds": ["number"] // Array of subtask IDs in desired order
}
```
**Response:** No content (204)

#### Delete Subtask
```http
DELETE /api/subtasks/:id
```
**Parameters:**
- `id` (number): Subtask ID

**Response:** No content (204)

### Comments

#### Create Comment
```http
POST /api/comments
```
**Body:**
```json
{
  "content": "string",
  "issueId": "number",
  "parentId": "number" // optional for replies
}
```
**Response:** Created Comment object

#### Get Comments by Issue
```http
GET /api/comments/issue/:issueId
```
**Parameters:**
- `issueId` (number): Issue ID

**Response:** Array of Comment objects with nested replies

#### Get Comment by ID
```http
GET /api/comments/:id
```
**Parameters:**
- `id` (number): Comment ID

**Response:** Comment object

#### Update Comment
```http
PATCH /api/comments/:id
```
**Parameters:**
- `id` (number): Comment ID

**Body:**
```json
{
  "content": "string"
}
```
**Response:** Updated Comment object

#### Delete Comment
```http
DELETE /api/comments/:id
```
**Parameters:**
- `id` (number): Comment ID

**Response:** No content (204)

### Time Tracking

#### Log Time
```http
POST /api/time-tracking/log
```
**Body:**
```json
{
  "hours": "number", // e.g., 2.5 for 2 hours 30 minutes
  "description": "string", // optional
  "date": "string", // ISO date string, e.g., "2024-01-15"
  "issueId": "number"
}
```
**Response:** Created TimeLog object

#### Get Time Logs by Issue
```http
GET /api/time-tracking/issue/:issueId
```
**Parameters:**
- `issueId` (number): Issue ID

**Response:** Array of TimeLog objects

#### Get Time Tracking Summary
```http
GET /api/time-tracking/issue/:issueId/summary
```
**Parameters:**
- `issueId` (number): Issue ID

**Response:**
```json
{
  "totalTimeSpent": "number",
  "originalEstimate": "number",
  "remainingEstimate": "number",
  "timeSpentByUser": [
    {
      "userId": "number",
      "userName": "string",
      "hours": "number"
    }
  ],
  "recentTimeLogs": [TimeLog]
}
```

#### Get Time Log by ID
```http
GET /api/time-tracking/log/:id
```
**Parameters:**
- `id` (number): Time log ID

**Response:** TimeLog object

#### Update Time Log
```http
PATCH /api/time-tracking/log/:id
```
**Parameters:**
- `id` (number): Time log ID

**Body:** Partial TimeLog object
**Response:** Updated TimeLog object

#### Delete Time Log
```http
DELETE /api/time-tracking/log/:id
```
**Parameters:**
- `id` (number): Time log ID

**Response:** No content (204)

#### Parse Time Input
```http
POST /api/time-tracking/parse-time
```
**Body:**
```json
{
  "timeStr": "string" // e.g., "2h 30m", "1.5h", "90m"
}
```
**Response:**
```json
{
  "hours": "number",
  "formatted": "string",
  "error": "string" // if parsing failed
}
```

### Attachments

#### Upload File
```http
POST /api/attachments/upload/:issueId
```
**Parameters:**
- `issueId` (number): Issue ID

**Body:** Multipart form data with `file` field
**Response:** Created Attachment object

#### Get Attachments by Issue
```http
GET /api/attachments/issue/:issueId
```
**Parameters:**
- `issueId` (number): Issue ID

**Response:** Array of Attachment objects

#### Get Attachment by ID
```http
GET /api/attachments/:id
```
**Parameters:**
- `id` (number): Attachment ID

**Response:** Attachment object

#### Download File
```http
GET /api/attachments/download/:id
```
**Parameters:**
- `id` (number): Attachment ID

**Response:** File download with appropriate headers

#### Delete Attachment
```http
DELETE /api/attachments/:id
```
**Parameters:**
- `id` (number): Attachment ID

**Response:** No content (204)

### Sprints

#### Create Sprint
```http
POST /api/sprints
```
**Body:**
```json
{
  "name": "string",
  "goal": "string", // optional
  "projectId": "number",
  "createdById": "number"
}
```
**Response:** Created Sprint object

#### Get Sprints by Project
```http
GET /api/sprints?projectId=:projectId
```
**Query Parameters:**
- `projectId` (number): Project ID

**Response:** Array of Sprint objects with related issues, ordered by position

#### Get Sprint by ID
```http
GET /api/sprints/:id
```
**Parameters:**
- `id` (number): Sprint ID

**Response:** Sprint object with related issues and project

#### Update Sprint
```http
PATCH /api/sprints/:id
```
**Parameters:**
- `id` (number): Sprint ID

**Body:** Partial Sprint object
**Response:** Updated Sprint object

#### Start Sprint
```http
POST /api/sprints/:id/start
```
**Parameters:**
- `id` (number): Sprint ID

**Body:**
```json
{
  "startDate": "string", // ISO date string
  "endDate": "string"    // ISO date string
}
```

**Common Duration Templates:**
- 1 Day: `endDate = new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000)`
- 1 Week: `endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000)`
- 2 Weeks (Recommended): `endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000)`
- Custom: Calculate based on desired number of days

**Response:** Updated Sprint object with status 'active'

#### Complete Sprint
```http
POST /api/sprints/:id/complete
```
**Parameters:**
- `id` (number): Sprint ID

**Response:** Updated Sprint object with status 'completed'

#### Add Issue to Sprint
```http
POST /api/sprints/:id/add-issue/:issueId
```
**Parameters:**
- `id` (number): Sprint ID
- `issueId` (number): Issue ID

**Response:** No content (204)

#### Remove Issue from Sprint
```http
POST /api/sprints/remove-issue/:issueId
```
**Parameters:**
- `issueId` (number): Issue ID

**Response:** No content (204)

#### Get Backlog Issues
```http
GET /api/sprints/backlog?projectId=:projectId
```
**Query Parameters:**
- `projectId` (number): Project ID

**Response:** Array of Issue objects not assigned to any sprint

#### Delete Sprint
```http
DELETE /api/sprints/:id
```
**Parameters:**
- `id` (number): Sprint ID

**Note:** All issues in the sprint are moved back to the backlog

**Response:** No content (204)

## Common Usage Patterns for AI Agents

### 1. Creating a Bug Report from Test Failures
```javascript
// Step 1: Get the project
const projects = await fetch('http://localhost:4000/api/projects').then(r => r.json())
const project = projects.find(p => p.key === 'JC') // or specific project

// Step 2: Create a bug issue
const bugIssue = await fetch('http://localhost:4000/api/issues', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Test failure: Login functionality broken',
    description: 'Automated test found that login fails with error: ...',
    status: 'todo',
    priority: 'high',
    type: 'bug',
    projectId: project.id,
    reporterId: 1, // Bot user ID
    labels: ['automated-test', 'ci-failure']
  })
}).then(r => r.json())
```

### 2. Updating Issue Status
```javascript
// Move issue to in progress
await fetch(`http://localhost:4000/api/issues/${issueId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'in_progress',
    assigneeId: userId
  })
})
```

### 3. Getting Current Kanban Board State
```javascript
// Get all issues for a project
const issues = await fetch(`http://localhost:4000/api/issues?projectId=${projectId}`)
  .then(r => r.json())

// Group by status
const board = {
  todo: issues.filter(i => i.status === 'todo'),
  in_progress: issues.filter(i => i.status === 'in_progress'),
  done: issues.filter(i => i.status === 'done')
}
```

### 4. Creating a Complete Issue with Subtasks and Time Tracking
```javascript
// Step 1: Create main issue
const mainIssue = await fetch('http://localhost:4000/api/issues', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Implement user authentication',
    description: 'Add JWT-based authentication to the application',
    status: 'todo',
    priority: 'high',
    type: 'story',
    projectId: 1,
    reporterId: 1,
    estimate: 0.133 // 8 minutes,
    labels: ['authentication', 'security']
  })
}).then(r => r.json())

// Step 2: Create subtasks
const subtasks = [
  'Design authentication flow',
  'Implement JWT token generation',
  'Add login/logout endpoints',
  'Create user registration'
]

for (const subtaskTitle of subtasks) {
  await fetch('http://localhost:4000/api/subtasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: subtaskTitle,
      parentIssueId: mainIssue.id,
      estimate: 2
    })
  })
}

// Step 3: Add initial comment
await fetch('http://localhost:4000/api/comments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'Starting work on authentication implementation',
    issueId: mainIssue.id
  })
})
```

### 5. Time Tracking Workflow
```javascript
// Log time worked
await fetch('http://localhost:4000/api/time-tracking/log', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    hours: 2.5, // 2 hours 30 minutes
    description: 'Implemented JWT token generation logic',
    date: '2024-01-15',
    issueId: issueId
  })
})

// Get time tracking summary
const summary = await fetch(`http://localhost:4000/api/time-tracking/issue/${issueId}/summary`)
  .then(r => r.json())

console.log(`Total time spent: ${summary.totalTimeSpent} hours`)
console.log(`Contributors: ${summary.timeSpentByUser.length}`)
```

### 6. Managing Subtask Progress
```javascript
// Get subtask progress
const progress = await fetch(`http://localhost:4000/api/subtasks/issue/${issueId}/progress`)
  .then(r => r.json())

console.log(`Progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`)

// Complete a subtask
await fetch(`http://localhost:4000/api/subtasks/${subtaskId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'done' })
})
```

### 7. File Attachments
```javascript
// Upload a file (requires FormData)
const formData = new FormData()
formData.append('file', fileBlob, 'screenshot.png')

const attachment = await fetch(`http://localhost:4000/api/attachments/upload/${issueId}`, {
  method: 'POST',
  body: formData
}).then(r => r.json())

// Get all attachments for an issue
const attachments = await fetch(`http://localhost:4000/api/attachments/issue/${issueId}`)
  .then(r => r.json())
```

### 8. Comment Threads
```javascript
// Add a main comment
const mainComment = await fetch('http://localhost:4000/api/comments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'This looks good, but we should add error handling',
    issueId: issueId
  })
}).then(r => r.json())

// Reply to the comment
await fetch('http://localhost:4000/api/comments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'Agreed, I will add try-catch blocks',
    issueId: issueId,
    parentId: mainComment.id
  })
})
```

### 9. Sprint Management Workflow
```javascript
// Step 1: Create a new sprint
const sprint = await fetch('http://localhost:4000/api/sprints', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Sprint 1',
    goal: 'Complete user authentication features',
    projectId: projectId,
    createdById: 1
  })
}).then(r => r.json())

// Step 2: Get backlog issues
const backlogIssues = await fetch(`http://localhost:4000/api/sprints/backlog?projectId=${projectId}`)
  .then(r => r.json())

// Step 3: Add selected issues to sprint
const selectedIssues = backlogIssues.slice(0, 5) // Take first 5 issues
for (const issue of selectedIssues) {
  await fetch(`http://localhost:4000/api/sprints/${sprint.id}/add-issue/${issue.id}`, {
    method: 'POST'
  })
}

// Step 4: Start the sprint with duration template
const startDate = new Date()
let endDate

// Choose sprint duration template
const sprintDuration = '2-weeks' // Options: '1-day', '1-week', '2-weeks', or custom number of days

switch (sprintDuration) {
  case '1-day':
    endDate = new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000)
    break
  case '1-week':
    endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000)
    break
  case '2-weeks':
    endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000)
    break
  default:
    // For custom duration, use number of days
    const customDays = 21 // Example: 3 weeks
    endDate = new Date(startDate.getTime() + customDays * 24 * 60 * 60 * 1000)
}

const startedSprint = await fetch(`http://localhost:4000/api/sprints/${sprint.id}/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  })
}).then(r => r.json())

console.log(`Sprint "${startedSprint.name}" is now active`)

// Step 5: Later, complete the sprint
await fetch(`http://localhost:4000/api/sprints/${sprint.id}/complete`, {
  method: 'POST'
})
```

### 10. Epic and Issue Linking
```javascript
// Step 1: Create an epic
const epic = await fetch('http://localhost:4000/api/issues', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'User Management System',
    description: 'Complete user management functionality including auth, profiles, and permissions',
    status: 'todo',
    priority: 'high',
    type: 'epic',
    projectId: projectId,
    reporterId: 1,
    estimate: 40,
    labels: ['epic', 'user-management']
  })
}).then(r => r.json())

// Step 2: Create stories and link them to the epic
const stories = [
  'User Registration',
  'User Login',
  'Profile Management',
  'Password Reset'
]

for (const storyTitle of stories) {
  await fetch('http://localhost:4000/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: storyTitle,
      status: 'todo',
      priority: 'medium',
      type: 'story',
      projectId: projectId,
      reporterId: 1,
      epicId: epic.id, // Link to epic
      estimate: 0.133 // 8 minutes
    })
  })
}
```

### 11. Sprint Reporting and Analytics
```javascript
// Get all sprints for reporting
const sprints = await fetch(`http://localhost:4000/api/sprints?projectId=${projectId}`)
  .then(r => r.json())

// Filter completed sprints for historical analysis
const completedSprints = sprints.filter(sprint => sprint.status === 'completed')

// Calculate sprint metrics for each completed sprint
const sprintReports = completedSprints.map(sprint => {
  const totalIssues = sprint.issues.length
  const completedIssues = sprint.issues.filter(issue => issue.status === 'done').length
  const completionRate = totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0

  const totalEstimate = sprint.issues.reduce((sum, issue) => sum + (issue.estimate || 0), 0)
  const completedEstimate = sprint.issues
    .filter(issue => issue.status === 'done')
    .reduce((sum, issue) => sum + (issue.estimate || 0), 0)

  const sprintDuration = sprint.startDate && sprint.endDate
    ? Math.ceil((new Date(sprint.endDate) - new Date(sprint.startDate)) / (1000 * 60 * 60 * 24))
    : null

  return {
    id: sprint.id,
    name: sprint.name,
    status: sprint.status,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    duration: sprintDuration,
    totalIssues,
    completedIssues,
    completionRate: Math.round(completionRate),
    totalEstimate,
    completedEstimate,
    velocity: completedEstimate, // Story points completed
    goal: sprint.goal
  }
})

console.log('Sprint Reports:', sprintReports)

// Calculate team velocity trend (last 5 sprints)
const recentSprints = sprintReports.slice(-5)
const averageVelocity = recentSprints.reduce((sum, sprint) => sum + sprint.velocity, 0) / recentSprints.length
console.log(`Team average velocity: ${Math.round(averageVelocity)} points per sprint`)
```

### 12. Bulk Operations
```javascript
// Get all high priority bugs
const highPriorityBugs = await fetch('http://localhost:4000/api/issues')
  .then(r => r.json())
  .then(issues => issues.filter(i => i.priority === 'high' && i.type === 'bug'))

// Update multiple issues
for (const issue of highPriorityBugs) {
  await fetch(`http://localhost:4000/api/issues/${issue.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priority: 'urgent' })
  })
}
```

## Error Responses

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `201`: Created
- `204`: No Content
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error

Error responses include a message:
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

## AI Agent Complete Project Management Workflow

This section provides a comprehensive guide for AI agents to manage complete project lifecycles using the Jira Clone API, from project creation to sprint completion.

### AI Agent Best Practices

**Time Estimation Guidelines for AI:**
- AI agents typically work faster than humans, so time estimates should reflect this
- Use **minutes** instead of hours for estimates when AI is doing the work
- **Story Points:** Use 1-3 points for most AI tasks (1=simple, 2=moderate, 3=complex)
- **Sprint Duration:** Use 1-day sprints for AI work since AI can complete tasks rapidly
- **Time Logging:** Log actual time spent in minutes (e.g., 5-15 minutes per task)

**⚠️ IMPORTANT: Time Estimate API Format**
The API expects time estimates as **decimal hours** (numbers), not minute strings:
- **5 minutes** = `"estimate": 0.083` (5÷60)
- **8 minutes** = `"estimate": 0.133` (8÷60)
- **15 minutes** = `"estimate": 0.25` (15÷60)
- **30 minutes** = `"estimate": 0.5` (30÷60)

**❌ Incorrect:** `"estimate": 5` (= 5 hours!)
**❌ Incorrect:** `"estimate": "5m"` (API expects number)
**✅ Correct:** `"estimate": 0.083` (= 5 minutes)

**Quick Conversion Table for AI Tasks:**
| Minutes | Decimal Hours | Usage |
|---------|---------------|-------|
| 5 min   | 0.083        | Simple UI changes |
| 8 min   | 0.133        | Small component updates |
| 15 min  | 0.25         | Medium features |
| 30 min  | 0.5          | Complex implementations |

**Note:** The frontend TimeInput component can parse user-friendly formats like "5m" or "2h 30m", but the API create/update endpoints require decimal hours as numbers.

### Complete AI Workflow Example

```javascript
// ================================
// STEP 1: CREATE PROJECT
// ================================
const project = await fetch('http://localhost:4000/api/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'AI Task Automation',
    key: 'ATA',
    description: 'Automated task management and implementation by AI agent',
    leadId: 1 // AI user or bot user ID
  })
}).then(r => r.json())

// ================================
// STEP 2: CREATE ISSUES FOR THE TASK
// ================================
// Main task
const mainTask = await fetch('http://localhost:4000/api/issues', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Implement user authentication system',
    description: 'Create JWT-based authentication with login, logout, and registration functionality',
    status: 'todo',
    priority: 'high',
    type: 'story',
    projectId: project.id,
    reporterId: 1, // AI user ID
    assigneeId: 1, // Assign to AI user
    estimate: 0.25, // 15 minutes estimate for AI (15÷60 = 0.25 hours)
    storyPoints: 3, // Complex task
    labels: ['authentication', 'security', 'ai-task']
  })
}).then(r => r.json())

// Related technical tasks
const subTasks = [
  {
    title: 'Set up JWT token generation',
    description: 'Implement JWT token creation and validation logic',
    type: 'task',
    storyPoints: 1,
    estimate: 0.083 // 5 minutes
  },
  {
    title: 'Create login API endpoint',
    description: 'POST /api/auth/login endpoint with email/password validation',
    type: 'task',
    storyPoints: 2,
    estimate: 0.133 // 8 minutes
  },
  {
    title: 'Create registration API endpoint',
    description: 'POST /api/auth/register endpoint with user validation',
    type: 'task',
    storyPoints: 2,
    estimate: 0.117 // 7 minutes
  }
]

// Create all sub-tasks
const createdSubTasks = []
for (const task of subTasks) {
  const subTask = await fetch('http://localhost:4000/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...task,
      status: 'todo',
      priority: 'medium',
      projectId: project.id,
      reporterId: 1,
      assigneeId: 1,
      labels: ['ai-task', 'subtask']
    })
  }).then(r => r.json())

  createdSubTasks.push(subTask)
}

// ================================
// STEP 3: CREATE AND START SPRINT
// ================================
// Create 1-day sprint (optimal for AI work)
const sprint = await fetch('http://localhost:4000/api/sprints', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'AI Sprint - Authentication Implementation',
    goal: 'Complete authentication system implementation',
    projectId: project.id,
    createdById: 1
  })
}).then(r => r.json())

// Add all issues to sprint
const allIssues = [mainTask, ...createdSubTasks]
for (const issue of allIssues) {
  await fetch(`http://localhost:4000/api/sprints/${sprint.id}/add-issue/${issue.id}`, {
    method: 'POST'
  })
}

// Start 1-day sprint
const startDate = new Date()
const endDate = new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000) // 1 day

const activeSprint = await fetch(`http://localhost:4000/api/sprints/${sprint.id}/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  })
}).then(r => r.json())

console.log(`Sprint "${activeSprint.name}" started for 1 day`)

// ================================
// STEP 4: WORK ON TASKS
// ================================
for (const issue of allIssues) {
  // Move task to IN PROGRESS before starting work
  await fetch(`http://localhost:4000/api/issues/${issue.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' })
  })

  // Add comment about starting work
  await fetch('http://localhost:4000/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `🤖 AI Agent: Starting work on "${issue.title}"`,
      issueId: issue.id
    })
  })

  // ============================
  // DO THE ACTUAL WORK HERE
  // ============================
  // This is where the AI would implement the feature/fix the bug
  console.log(`AI is working on: ${issue.title}`)

  // Simulate work time (in a real scenario, this would be actual implementation)
  const workStartTime = new Date()

  // ** AI IMPLEMENTATION WORK HAPPENS HERE **
  // - Write code
  // - Create files
  // - Run tests
  // - Fix issues

  const workEndTime = new Date()
  const actualMinutesWorked = Math.round((workEndTime.getTime() - workStartTime.getTime()) / (1000 * 60))

  // Log time worked (in minutes for AI)
  await fetch('http://localhost:4000/api/time-tracking/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hours: actualMinutesWorked / 60, // Convert minutes to hours for API
      description: `AI implementation of ${issue.title}`,
      date: new Date().toISOString().split('T')[0],
      issueId: issue.id
    })
  })

  // Add completion comment
  await fetch('http://localhost:4000/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `✅ AI Agent: Completed "${issue.title}" in ${actualMinutesWorked} minutes. Implementation includes proper error handling and testing.`,
      issueId: issue.id
    })
  })

  // Check if any bugs or additional issues were discovered
  const bugsFound = [] // AI would populate this based on testing

  // Create bug tickets if issues were found
  for (const bug of bugsFound) {
    const bugIssue = await fetch('http://localhost:4000/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Bug: ${bug.title}`,
        description: `Found during implementation of ${issue.title}: ${bug.description}`,
        status: 'todo',
        priority: 'high',
        type: 'bug',
        projectId: project.id,
        reporterId: 1,
        assigneeId: 1,
        estimate: 0.083 // 5 minutes, // 5 minutes to fix
        storyPoints: 1,
        labels: ['ai-found-bug', 'urgent-fix']
      })
    }).then(r => r.json())

    // Add bug to current sprint
    await fetch(`http://localhost:4000/api/sprints/${sprint.id}/add-issue/${bugIssue.id}`, {
      method: 'POST'
    })

    // Immediately work on critical bugs
    if (bug.critical) {
      // Move to in progress and fix immediately
      await fetch(`http://localhost:4000/api/issues/${bugIssue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' })
      })

      // Fix the bug...

      // Mark as done
      await fetch(`http://localhost:4000/api/issues/${bugIssue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' })
      })
    }
  }

  // Move original task to DONE
  await fetch(`http://localhost:4000/api/issues/${issue.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'done' })
  })

  console.log(`✅ Completed: ${issue.title}`)
}

// ================================
// STEP 5: COMPLETE SPRINT
// ================================
// Check if all tasks are completed
const sprintIssues = await fetch(`http://localhost:4000/api/sprints/${sprint.id}`)
  .then(r => r.json())

const allCompleted = sprintIssues.issues.every(issue => issue.status === 'done')

if (allCompleted) {
  // Complete the sprint
  const completedSprint = await fetch(`http://localhost:4000/api/sprints/${sprint.id}/complete`, {
    method: 'POST'
  }).then(r => r.json())

  console.log(`🎉 Sprint "${completedSprint.name}" completed successfully!`)

  // Add final sprint summary comment to main task
  const completionStats = {
    totalIssues: sprintIssues.issues.length,
    completedIssues: sprintIssues.issues.filter(i => i.status === 'done').length,
    totalTimeMinutes: actualMinutesWorked, // Sum of all logged time
    totalStoryPoints: sprintIssues.issues.reduce((sum, i) => sum + (i.storyPoints || 0), 0)
  }

  await fetch('http://localhost:4000/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `🏁 Sprint Completed by AI Agent:
📊 ${completionStats.completedIssues}/${completionStats.totalIssues} issues completed
⏱️ Total time: ${completionStats.totalTimeMinutes} minutes
📈 Story points delivered: ${completionStats.totalStoryPoints}
🤖 All tasks completed successfully with automated testing and documentation.`,
      issueId: mainTask.id
    })
  })
} else {
  console.log('⚠️ Not all tasks completed. Sprint will remain active.')
}
```

### AI Agent Task Management Patterns

#### 1. **Rapid Iteration Pattern**
```javascript
// For AI agents: Create smaller, focused sprints
const quickSprint = await createSprint({
  name: 'AI Quick Fix Sprint',
  duration: '1-day', // AI can complete tasks quickly
  goal: 'Fix critical bugs and implement small features'
})
```

#### 2. **Smart Issue Creation Pattern**
```javascript
// AI should create issues with appropriate sizing for automation
const aiOptimizedIssue = {
  title: 'Implement API endpoint validation',
  type: 'task', // Use 'task' for technical work, 'story' for features
  storyPoints: 1, // 1-3 scale works best for AI tasks
  estimate: 10, // Minutes, not hours
  priority: 'medium', // Reserve 'urgent' for truly critical items
  labels: ['ai-task', 'backend', 'validation']
}
```

#### 3. **Automated Testing and QA Pattern**
```javascript
// AI should create and execute test issues
const testIssue = await createIssue({
  title: 'Automated testing for authentication system',
  type: 'task',
  description: 'Create comprehensive test suite and run validation',
  storyPoints: 2,
  estimate: 0.25,
  labels: ['testing', 'ai-automated', 'quality-assurance']
})
```

#### 4. **Continuous Improvement Pattern**
```javascript
// AI can identify and create improvement tasks
const improvementIssue = await createIssue({
  title: 'Optimize database query performance',
  type: 'task',
  description: 'Analyze and improve slow queries found during implementation',
  storyPoints: 2,
  estimate: 0.2, // 12 minutes
  priority: 'low',
  labels: ['optimization', 'ai-suggested', 'performance']
})
```

### AI-Specific API Usage Notes

1. **Time Tracking**: Always use decimal hours (minutes/60) when logging time
2. **Comments**: Include AI agent identifier in comments for audit trail
3. **Labels**: Use consistent labeling: `['ai-task', 'category', 'priority-level']`
4. **Sprint Duration**: 1-day sprints work best for AI workflow
5. **Issue Types**:
   - `story`: User-facing features
   - `task`: Technical implementation work
   - `bug`: Issues found during development
   - `epic`: Large features broken into smaller stories

### Error Handling for AI Agents

```javascript
// Always wrap API calls in try-catch for robust AI operation
async function aiSafeApiCall(apiCall, fallbackAction) {
  try {
    return await apiCall()
  } catch (error) {
    console.error('AI API Error:', error.message)

    // Log error as a bug issue
    await createIssue({
      title: `API Error: ${error.message}`,
      type: 'bug',
      priority: 'high',
      description: `AI agent encountered error: ${error.stack}`,
      labels: ['ai-error', 'investigation-needed']
    })

    // Execute fallback if provided
    if (fallbackAction) {
      return await fallbackAction()
    }
  }
}
```

## Future Enhancements

### Authentication (Planned)
Future versions will include API token authentication:
```http
Authorization: Bearer <api-token>
```

### WebSocket Support (Planned)
Real-time updates will be available via WebSocket connection at `/socket.io`

### Filtering and Search (Planned)
Advanced query parameters for filtering:
- `status`: Filter by issue status
- `priority`: Filter by priority
- `assigneeId`: Filter by assignee
- `search`: Full-text search across title and description

### Bulk Operations (Planned)
Dedicated bulk endpoints for efficiency:
- `POST /api/issues/bulk-update`
- `POST /api/issues/bulk-delete`