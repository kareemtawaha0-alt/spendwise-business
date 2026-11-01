# Spendwise Business

**A multi-tenant business expense and budget management platform.**

Spendwise Business is a full-stack SaaS-style web application designed to help organizations manage department budgets, employee expense requests, approval workflows, and financial reporting through a centralized platform.

Built as a portfolio project with a focus on secure data isolation, role-based access control, and real-world business workflows.

## Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Supabase
- **Database:** PostgreSQL
- **Authentication:** Supabase Auth
- **Security:** Row Level Security (RLS), role-based access control
- **Deployment:** Vercel (planned)

## Key Features

### Organization Management
- Organization onboarding and workspace setup
- Multi-tenant architecture with organization-level data isolation
- Single-organization membership per user account
- Invitation-based team membership

### Role-Based Access Control
Four user roles with different permissions:

- **Owner:** Organization administration and full financial visibility
- **Finance Manager:** Company-wide budget and expense management
- **Department Manager:** Department-scoped financial visibility
- **Employee:** Expense request submission with limited access

### Budget Management
- Monthly department budgets
- Budget allocation and updates
- Automatic monthly budget renewal
- Budget utilization and remaining balance tracking
- Historical budget separation

### Expense Requests and Approvals
- Employee expense request submission
- Approval and rejection workflows
- Role-based authorization
- Expense status tracking
- Payment recording

### Reporting
- Monthly and yearly financial reports
- Department-level spending summaries
- PDF and CSV exports

### Additional Features
- In-app notifications
- Arabic and English interface
- Authentication and password recovery
- Responsive dashboard interfaces

## Security and Architecture

- PostgreSQL Row Level Security (RLS)
- Organization-scoped data access
- Role-based permissions
- Database-level single-organization membership enforcement
- Supabase authentication
- Server-side API routes for selected workflows

## Local Development

### Prerequisites

- Node.js
- npm
- A configured Supabase project

### Installation

```bash
git clone https://github.com/kareemtawaha0-alt/spendwise-business.git
cd spendwise-business
npm install
```

Configure the required environment variables in `.env.local`, using the variable names expected by the project.

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000.

## Project Status

Spendwise Business is a portfolio project demonstrating full-stack development, database design, authentication, authorization, and business workflow implementation.

The application is not currently presented as a commercially launched SaaS product.

## Author

**Kareem Tawaha**

[GitHub](https://github.com/kareemtawaha0-alt)