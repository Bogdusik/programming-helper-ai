# 🤖 Programming Helper AI

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15.5.4-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![React](https://img.shields.io/badge/React-19.1.0-61DAFB?style=for-the-badge&logo=react)
![Prisma](https://img.shields.io/badge/Prisma-6.16.2-2D3748?style=for-the-badge&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-336791?style=for-the-badge&logo=postgresql)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT-412991?style=for-the-badge&logo=openai)

**AI-powered programming assistant designed for academic research on AI-assisted learning**

[Features](#-features) • [How to Use](#-how-to-use) • [Tech Stack](#-tech-stack) • [Contributing](#-contributing)

</div>

---

## 📖 Overview

Programming Helper AI is an intelligent coding assistant that helps developers learn programming concepts, debug code, and solve programming challenges. Built as part of academic research on AI-assisted programming education, the platform provides instant AI-powered assistance with a focus on learning and skill development.

### Key Highlights

- 🚀 **Instant AI Responses** - Get real-time help with your programming questions
- 🎯 **Smart Code Analysis** - AI-powered code review and debugging assistance
- 🌍 **Multi-Language Support** - JavaScript, Python, Java, C++, TypeScript, and more
- 📊 **Progress Tracking** - Monitor your learning journey with detailed statistics
- 🎓 **Learning Tasks** - Structured programming challenges with guided assistance
- 🔒 **Privacy-First** - GDPR-compliant with anonymous user identification

---

## ✨ Features

### Core Functionality

- **💬 Interactive Chat Interface**
  - Real-time AI conversations about programming
  - Session management with conversation history
  - Context-aware responses based on conversation history

- **📝 Code Analysis & Debugging**
  - Intelligent code review and suggestions
  - Bug detection and error explanations
  - Performance optimization recommendations

- **📚 Learning Management**
  - Pre and post-assessment quizzes
  - Structured programming tasks by difficulty
  - Progress tracking across multiple languages
  - Personalized learning paths

- **📊 Analytics Dashboard**
  - User statistics and progress metrics
  - Global platform statistics
  - Learning analytics and insights

- **👤 User Profile System**
  - Skill level assessment
  - Learning goals configuration
  - Language preferences
  - Onboarding flow for new users

### Research Features

- **🔬 Academic Research Compliance**
  - GDPR-compliant data collection
  - Anonymous user identification
  - Research consent mechanism
  - Ethical data handling practices

---

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 15.5.4 (App Router)
- **UI Library**: React 19.1.0
- **Styling**: Tailwind CSS 4
- **Type Safety**: TypeScript 5
- **State Management**: TanStack Query (React Query)
- **API Client**: tRPC 11.5.1

### Backend
- **Runtime**: Node.js
- **API**: tRPC (Type-safe APIs)
- **Database**: PostgreSQL
- **ORM**: Prisma 6.16.2
- **Authentication**: Clerk 6.32.2

### AI & Services
- **AI Provider**: OpenAI GPT (via OpenAI API)
- **Email**: Resend
- **Analytics**: Vercel Analytics & Speed Insights
- **Deployment**: Vercel

### Development Tools
- **Testing**: Jest 30.2.0, React Testing Library
- **Linting**: ESLint 9
- **Type Checking**: TypeScript
- **Package Manager**: npm

---

## 🚀 How to Use

### Getting Started

1. **Visit the Application**
   
   Access Programming Helper AI through the live application (URL available in deployment or contact the research team)

2. **Sign Up / Sign In**
   
   - Click the "Get Started" button on the homepage
   - Create an account using your preferred authentication method
   - Complete the quick onboarding process

3. **Complete Your Profile**
   
   - Set your programming experience level
   - Select your preferred programming languages
   - Define your learning goals

4. **Take the Assessment**
   
   - Complete the pre-assessment quiz to evaluate your current skills
   - This helps personalize your learning experience

5. **Start Chatting with AI**
   
   - Ask any programming question
   - Get instant AI-powered assistance
   - Receive code explanations and debugging help

### Using the Features

#### 💬 Chat Interface
- Start a new conversation or continue existing sessions
- Ask questions about any programming language
- Get code examples, explanations, and debugging help
- View conversation history in the sidebar

#### 📚 Learning Tasks
- Browse programming challenges by difficulty
- Select tasks based on your preferred languages
- Get hints and guided assistance
- Track your progress

#### 📊 Statistics Dashboard
- View your learning progress
- See your question history
- Monitor improvement over time
- Check global platform statistics

#### ⚙️ Settings
- Update your profile
- Change language preferences
- Adjust learning goals
- Manage your account

---

## 👨‍💻 For Developers

If you're interested in contributing or setting up the project locally, see the [Development Guide](#-development) section below.

### 📚 Documentation

- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference with all REST and tRPC endpoints, authentication, and usage examples
- **[Research Ethics](./RESEARCH_ETHICS.md)** - Research compliance and data handling guidelines
- **Postman Collection** - Available in `postman/` directory for API testing

---

## 📁 Project Structure

```
programming-helper-ai/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── chat/              # Chat interface
│   ├── admin/             # Admin dashboard
│   ├── stats/             # Statistics page
│   └── ...
├── components/            # React components
│   ├── ChatBox.tsx       # Main chat interface
│   ├── ChatSidebar.tsx   # Chat sessions sidebar
│   ├── Navbar.tsx        # Navigation bar
│   └── ...
├── lib/                   # Core libraries
│   ├── trpc.ts           # tRPC router and procedures
│   ├── openai.ts         # OpenAI integration
│   ├── db.ts             # Prisma client
│   ├── auth.ts           # Authentication utilities
│   └── ...
├── prisma/               # Database schema and migrations
│   ├── schema.prisma    # Prisma schema
│   └── migrations/      # Database migrations
├── __tests__/            # Test files
│   ├── components/      # Component tests
│   ├── lib/             # Library tests
│   └── api/             # API tests
├── hooks/                # Custom React hooks
├── scripts/              # Utility scripts
└── public/               # Static assets
```

---

## 🧪 Testing

Run tests with Jest:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

### Test Coverage

The project maintains test coverage for:
- React components
- API endpoints
- Utility functions
- Business logic

---

## 🏗 Development

This section is for developers who want to contribute or set up the project locally.

### Prerequisites

- Node.js 20+ 
- PostgreSQL 14+
- npm or yarn
- OpenAI API key
- Clerk account (for authentication)

### Local Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Bogdusik/programming-helper-ai.git
   cd programming-helper-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/programming_helper_ai"

   # OpenAI
   OPENAI_API_KEY="your-openai-api-key"

   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your-clerk-publishable-key"
   CLERK_SECRET_KEY="your-clerk-secret-key"

   # App URL
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma Client
   npm run db:generate

   # Push schema to database
   npm run db:push

   # (Optional) Seed the database
   npm run db:seed

   # (Optional) Initialize rate limits
   npm run db:init-rate-limits
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

### Database Setup (macOS)

For macOS users with Homebrew:

```bash
# Start PostgreSQL service
npm run db:start

# Check service status
npm run db:status

# Stop PostgreSQL service
npm run db:stop
```

For other platforms, use your system's PostgreSQL service manager.

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix          # Fix ESLint errors
npm run type-check       # TypeScript type checking

# Database
npm run db:generate       # Generate Prisma Client
npm run db:push          # Push schema changes
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio
```

### Code Style

- TypeScript strict mode enabled
- ESLint with Next.js and TypeScript rules
- Prettier for code formatting (if configured)
- Consistent naming conventions

---

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository in Vercel
3. Configure environment variables
4. Deploy!

The project includes `vercel.json` with optimized settings for Vercel deployment.

### Environment Variables for Production

Ensure all environment variables from `.env.local` are set in your deployment platform.

---

## 🔬 Research Ethics

This application is designed for academic research on AI-assisted programming learning. All data collection complies with ethical research standards and GDPR requirements.

### Privacy & Data Collection

- ✅ **Collected (anonymized)**: User interactions, questions, responses, usage statistics
- ❌ **Not collected**: Email addresses, personal information, identifiable data

### Research Compliance

- Anonymous user identification (Clerk-generated IDs only)
- Explicit research consent mechanism
- GDPR-compliant data handling
- Participant rights (withdrawal, data deletion, access)

For more details, see [RESEARCH_ETHICS.md](./RESEARCH_ETHICS.md).

---

## 📊 Features in Detail

### Chat System
- Real-time messaging with AI assistant
- Conversation history and session management
- Context-aware responses
- Rate limiting (10 requests/minute)

### Assessment System
- Pre-assessment quiz for skill evaluation
- Post-assessment to measure improvement
- Automatic scoring and feedback

### Task System
- Programming challenges by difficulty level
- Multiple programming languages
- Hints and guided assistance
- Progress tracking

### Statistics & Analytics
- User-specific statistics
- Global platform metrics
- Learning progress tracking
- Performance analytics

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Set up the project locally (see [Development](#-development) section)
4. Make your changes
5. Write or update tests as needed
6. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
7. Push to the branch (`git push origin feature/AmazingFeature`)
8. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation as needed
- Follow the existing code style
- Ensure all tests pass before submitting PR

---

## 📝 License

This project is part of academic research. Please contact the research team for licensing information.

---

## 👥 Authors

- **Bogdusik** - *Initial work* - [GitHub](https://github.com/Bogdusik)

---

## 🙏 Acknowledgments

- OpenAI for the GPT API
- Vercel for hosting and analytics
- Clerk for authentication
- The open-source community for amazing tools and libraries

---

## 📞 Contact & Support

For questions, issues, or research inquiries:

- **GitHub Issues**: [Open an issue](https://github.com/Bogdusik/programming-helper-ai/issues)
- **Research Contact**: See [RESEARCH_ETHICS.md](./RESEARCH_ETHICS.md)

---

<div align="center">

**Made with ❤️ for the programming community**

⭐ Star this repo if you find it helpful!

</div>

