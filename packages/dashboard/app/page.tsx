'use client'

import { useState, useEffect } from 'react'

// Mock data - in a real implementation, this would come from the API
const mockData = {
  adherenceScore: 87,
  totalProjects: 12,
  totalViolations: 234,
  totalFiles: 1543,
  trends: [
    { month: 'Jan', score: 82, violations: 45 },
    { month: 'Feb', score: 85, violations: 38 },
    { month: 'Mar', score: 87, violations: 32 },
    { month: 'Apr', score: 89, violations: 28 },
    { month: 'May', score: 87, violations: 31 },
    { month: 'Jun', score: 90, violations: 25 },
  ],
  ruleViolations: [
    { rule: 'No Inline Styles', count: 89, severity: 'error' },
    { rule: 'Missing Design Tokens', count: 67, severity: 'warn' },
    { rule: 'Inconsistent Spacing', count: 45, severity: 'warn' },
    { rule: 'Unused Components', count: 33, severity: 'info' },
  ],
  projectHealth: [
    { name: 'Web App', score: 92, violations: 12 },
    { name: 'Mobile App', score: 88, violations: 18 },
    { name: 'Admin Panel', score: 85, violations: 24 },
    { name: 'Marketing Site', score: 78, violations: 35 },
  ]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setIsLoading(false), 1000)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Stile Dashboard</h1>
              <p className="text-gray-600">Design System Analytics & Adherence</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                System Healthy
              </span>
              <button className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                Export Report
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Adherence Score</p>
                <p className="text-2xl font-bold text-gray-900">{mockData.adherenceScore}%</p>
                <p className="text-xs text-gray-500">+3% from last month</p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600">↗</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900">{mockData.totalProjects}</p>
                <p className="text-xs text-gray-500">Active repositories</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600">👥</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Violations</p>
                <p className="text-2xl font-bold text-gray-900">{mockData.totalViolations}</p>
                <p className="text-xs text-gray-500">-12% from last month</p>
              </div>
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600">⚠</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Files Scanned</p>
                <p className="text-2xl font-bold text-gray-900">{mockData.totalFiles.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Across all projects</p>
              </div>
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600">📄</span>
              </div>
            </div>
          </div>
        </div>

        {/* Project Health */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Project Health</h2>
            <p className="text-sm text-gray-600">Adherence scores by project</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {mockData.projectHealth.map((project, index) => (
                <div key={project.name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <div>
                      <h3 className="font-medium text-gray-900">{project.name}</h3>
                      <p className="text-sm text-gray-500">{project.violations} violations</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                      project.score >= 90 ? 'bg-green-100 text-green-800' : 
                      project.score >= 80 ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {project.score}%
                    </span>
                    <button className="text-sm text-gray-600 hover:text-gray-900">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
