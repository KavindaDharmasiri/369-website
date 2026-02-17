# Loading Screen Usage Guide

## How to Use the Loading Screen

The loading screen is now globally available throughout your app. Here's how to use it:

### 1. Import the hook in any component:

```typescript
import { useLoading } from '@/lib/LoadingContext'
```

### 2. Use it in your component:

```typescript
const { showLoading, hideLoading } = useLoading()

// Show loading screen
showLoading()

// Hide loading screen
hideLoading()
```

### 3. Example Usage in API Calls:

```typescript
const handleSubmit = async () => {
  const { showLoading, hideLoading } = useLoading()
  
  showLoading() // Show loading screen
  
  try {
    const res = await fetch('/api/something', {
      method: 'POST',
      body: JSON.stringify(data)
    })
    // Handle response
  } catch (error) {
    console.error(error)
  } finally {
    hideLoading() // Hide loading screen
  }
}
```

### 4. Example in Category Page:

Replace your existing loading state with the global loading screen:

```typescript
'use client'
import { useLoading } from '@/lib/LoadingContext'

export default function CategoryManagement() {
  const { showLoading, hideLoading } = useLoading()
  
  const fetchCategories = async () => {
    showLoading()
    try {
      // Your fetch logic
    } finally {
      hideLoading()
    }
  }
  
  const handleAddCategory = async () => {
    showLoading()
    try {
      // Your add logic
    } finally {
      hideLoading()
    }
  }
}
```

## Features:

✅ Animated "369" letters with jumping effect
✅ Smooth fade in/out transitions
✅ Professional spinner animation
✅ Backdrop blur effect
✅ Global state management
✅ Can be triggered from any component
✅ Automatically waits in background until needed

## Customization:

To customize colors, animations, or styling, edit:
- `/src/components/LoadingScreen.module.css`
