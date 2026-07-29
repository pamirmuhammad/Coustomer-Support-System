/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { BrowserRouter } from 'react-router-dom';

// Test helper component that throws an error on render
const ProblemChild = () => {
  throw new Error('Test error');
};

// Unit tests for the ErrorBoundary component
describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <BrowserRouter>
        <ErrorBoundary>
          <div>All good</div>
        </ErrorBoundary>
      </BrowserRouter>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('renders fallback UI on error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <BrowserRouter>
        <ErrorBoundary>
          <ProblemChild />
        </ErrorBoundary>
      </BrowserRouter>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it('has a reload button visible on error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <BrowserRouter>
        <ErrorBoundary>
          <ProblemChild />
        </ErrorBoundary>
      </BrowserRouter>
    );

    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    spy.mockRestore();
  });
});
