# Spendwise Business

**A Full-Stack Multi-Tenant Business Expense & Budget Management Platform**

Spendwise Business is a full-stack web application designed to help organizations manage department budgets, employee expense requests, approval workflows, payments, and financial reporting through a centralized workspace.

The project focuses on real-world business workflows, secure multi-tenant architecture, role-based access control (RBAC), and database-level data isolation.

Built as a portfolio project to demonstrate full-stack software development, relational database design, authentication, authorization, and cloud deployment.

---

## Live Demo

**Live Application:** https://spendwise-business.vercel.app

**GitHub Repository:** https://github.com/kareemtawaha0-alt/spendwise-business

> **Note:** Spendwise Business is a portfolio project and is not currently a commercially launched SaaS product.

---

## Tech Stack

| Category | Technologies |
|---|---|
| Frontend | Next.js 16 (App Router), React, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes, Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Authorization | Row Level Security (RLS), Role-Based Access Control |
| Deployment | Vercel |
| Version Control | Git & GitHub |

---

## Key Features

### 1. Multi-Tenant Organization Management

- Organization onboarding and workspace creation
- Multi-tenant architecture with organization-level data isolation
- Database-enforced single-organization membership per user
- Invitation-based team onboarding
- Organization settings and management
- Secure organization deletion while preserving user authentication accounts

### 2. Role-Based Access Control (RBAC)

The platform supports four roles with different permissions and data visibility.

| Role | Responsibilities |
|---|---|
| **Owner** | Full organization administration, team management, and financial visibility |
| **Finance Manager** | Company-wide budget and expense management |
| **Department Manager** | Department-level financial visibility and management |
| **Employee** | Expense request submission with restricted access |

Permissions are enforced through application logic and PostgreSQL Row Level Security policies.

### 3. Budget Management

- Monthly department budgets
- Budget allocation and updates
- Automatic monthly budget renewal
- Budget utilization and remaining balance tracking
- Historical budget separation

### 4. Expense Requests & Approvals

- Employee expense request submission
- Approval and rejection workflows
- Role-based authorization
- Expense status tracking
- Payment recording

### 5. Financial Reporting

- Monthly and yearly financial reports
- Department-level spending summaries
- Budget and expense tracking
- PDF and CSV report exports

### 6. Notifications & User Experience

- In-app notifications
- Arabic and English language support
- Responsive dashboard interfaces
- Role-specific dashboards and data visibility
- Authentication and password recovery

---

## Security & Architecture

Security and organization-level data isolation are central to the application's design.

**Multi-Tenant Data Isolation**

Organizations operate in separate logical workspaces within a shared PostgreSQL database.

**PostgreSQL Row Level Security (RLS)**

Database policies restrict access to organization data based on authenticated users and their roles.

**Database-Level Membership Enforcement**

Each user account can belong to only one organization, enforced through database constraints.

**Role-Based Authorization**

Owners, finance managers, department managers, and employees have different permissions and levels of financial visibility.

**Authenticated Backend Operations**

Selected workflows use Next.js API Routes and PostgreSQL functions to perform authenticated operations.

**Organization Deletion**

Organization deletion removes associated business data and memberships while preserving users' Supabase Auth accounts.

---

## Application Workflow

A typical organization workflow:

1. A user registers and creates an organization.
2. The organization owner creates departments and configures budgets.
3. Team members are invited and assigned roles.
4. Employees submit expense requests.
5. Authorized managers review and approve or reject requests.
6. Payments can be recorded for approved expenses.
7. Financial activity is monitored through dashboards and reports.

---

## Application Screenshots

Screenshots demonstrating the main application workflows will be added here.

Planned screenshots include:

- Owner Dashboard
- Budget Management
- Expense Requests
- Approval Workflow
- Financial Reports
- Team Management

---

## Getting Started

### Prerequisites

- Node.js
- npm
- A Supabase project
- PostgreSQL database schema and RLS policies configured for the application

### Installation

Clone the repository:

```bash
git clone https://github.com/kareemtawaha0-alt/spendwise-business.git
cd spendwise-business
```

Install dependencies:

```bash
npm install
```

Configure the required environment variables in `.env.local` using the names expected by the project.

**Important:** Never commit `.env.local`, private credentials, or Supabase service-role keys to GitHub.

The application also requires its corresponding PostgreSQL tables, functions, constraints, and RLS policies to be configured in Supabase.

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Production Build

Run TypeScript validation:

```bash
npx tsc --noEmit
```

Create a production build:

```bash
npm run build
```

---

## Project Status

**Deployed — Portfolio Project**

Spendwise Business is deployed on Vercel and demonstrates a full-stack development workflow, including:

- Frontend application development
- Backend API integration
- Relational database design
- Authentication and authorization
- Multi-tenant data isolation
- Business workflow implementation
- Cloud deployment

The application is maintained as a portfolio project and is not currently presented as a commercially launched SaaS product.

---

## Author

**Kareem Tawaha**

GitHub: https://github.com/kareemtawaha0-alt

---

**Spendwise Business — Built with Next.js, TypeScript, PostgreSQL, and Supabase.**