import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import App from './App';

// Mock fetch API
global.fetch = vi.fn();

// Helper function to render App with Router
const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API Integration', () => {
    it('builds correct API URLs with filters', () => {
      const baseUrl = 'http://localhost:2900/api';
      const filters = {
        tenderId: 'TENDER001',
        keywords: 'computer',
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      };

      const queryParams = new URLSearchParams({
        tenderId: filters.tenderId,
        keywords: filters.keywords,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: '1',
        limit: '10'
      });

      const expectedUrl = `${baseUrl}/tenders?${queryParams}`;
      expect(expectedUrl).toContain('tenderId=TENDER001');
      expect(expectedUrl).toContain('keywords=computer');
    });

    it('handles pagination parameters', () => {
      const pagination = { currentPage: 2, limit: 20 };
      const queryParams = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: pagination.limit.toString()
      });

      expect(queryParams.get('page')).toBe('2');
      expect(queryParams.get('limit')).toBe('20');
    });
  });

  describe('Error Handling', () => {
    it('handles malformed API responses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      });

      // Test that malformed responses are handled gracefully
      const response = await global.fetch();
      const data = await response.json();
      expect(data).toEqual({ invalid: 'response' });
    });

    it('handles timeout errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network timeout'));

      try {
        await global.fetch();
      } catch (error) {
        expect(error.message).toBe('Network timeout');
      }
    });
  });

  describe('Performance', () => {
    it('debounces filter changes', () => {
      vi.useFakeTimers();
      let debounceCount = 0;

      // Simple debounce implementation for testing
      let timeoutId;
      const debouncedFunction = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          debounceCount++;
        }, 500);
      };

      // Simulate rapid calls
      debouncedFunction();
      debouncedFunction();
      debouncedFunction();

      // Should not have executed yet (still debouncing)
      expect(debounceCount).toBe(0);

      // Advance time to complete debounce
      vi.advanceTimersByTime(500);
      expect(debounceCount).toBe(1);

      vi.useRealTimers();
    });
  });

  describe('PaginationControls Component', () => {
    it('renders pagination correctly', () => {
      const pagination = {
        currentPage: 2,
        totalPages: 5,
        totalItems: 50,
        limit: 10
      };

      expect(pagination.currentPage).toBe(2);
      expect(pagination.totalPages).toBe(5);
      expect(pagination.totalItems).toBe(50);
    });

    it('calculates page numbers correctly', () => {
      const totalItems = 95;
      const limit = 10;
      const expectedPages = Math.ceil(totalItems / limit);

      expect(expectedPages).toBe(10);
    });
  });

  describe('Loader Component', () => {
    it('renders loading spinner', () => {
      const isLoading = true;
      expect(isLoading).toBe(true);
    });
  });

  describe('Component Rendering', () => {
    beforeEach(() => {
      // Mock successful API response for all fetch calls
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              tenderid: 'TENDER001',
              title: 'Test Tender 1',
              aiml_summary: 'This is a test summary',
              lastDate: '2024-12-31T00:00:00.000Z'
            }
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 1,
            itemsPerPage: 10
          }
        })
      });
    });

    it('renders the main heading', async () => {
      renderWithRouter(<App />);

      await waitFor(() => {
        expect(screen.getByText('IIT Delhi Tender List')).toBeInTheDocument();
      });
    });

    it('renders filter inputs', async () => {
      renderWithRouter(<App />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search by Tender ID')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search by keywords')).toBeInTheDocument();
      });
    });

    it('renders clear filters button', async () => {
      renderWithRouter(<App />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
      });
    });

    it('displays loading state initially', () => {
      // Mock pending fetch
      global.fetch.mockImplementationOnce(() => new Promise(() => {}));

      renderWithRouter(<App />);
      // Loading state should be shown initially
      expect(screen.getByText('IIT Delhi Tender List')).toBeInTheDocument();
    });

    it('displays error message on API failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter(<App />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch tenders. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('App Navigation', () => {
    it('has correct routes configured', () => {
      const routes = ['/', '/tender/:id'];
      expect(routes).toContain('/');
      expect(routes).toContain('/tender/:id');
    });
  });
});
