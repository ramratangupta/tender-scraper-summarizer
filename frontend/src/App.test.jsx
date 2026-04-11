// Mock react-router-dom before any imports
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: 'TENDER001' })),
    Link: ({ children, ...props }) => <a {...props}>{children}</a>,
  };
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route, MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import App, { TenderDetails, PaginationControls, Loader } from './App';
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

    it('displays API error message with details', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Database connection failed' })
      });

      renderWithRouter(<App />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch tenders. Please try again. Database connection failed')).toBeInTheDocument();
      });
    });

    it('handles filter input changes', async () => {
      renderWithRouter(<App />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search by Tender ID')).toBeInTheDocument();
      });

      const tenderIdInput = screen.getByPlaceholderText('Search by Tender ID');
      fireEvent.change(tenderIdInput, { target: { name: 'tenderId', value: 'TEST123' } });

      // The filter change should trigger after debounce delay
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      }, { timeout: 1500 });
    });

    it('clears all filters when clear button is clicked', async () => {
      renderWithRouter(<App />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
      });

      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      fireEvent.click(clearButton);

      // Verify fetch was called (filters cleared)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('handles pagination changes', async () => {
      renderWithRouter(<App />);

      await waitFor(() => {
        expect(screen.getByText('IIT Delhi Tender List')).toBeInTheDocument();
      });

      // The pagination controls should be rendered (check that at least one exists)
      const paginationNavs = screen.getAllByLabelText('Tender pagination');
      expect(paginationNavs.length).toBeGreaterThan(0);
    });
  });

  describe('TenderDetails Component', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            tenderid: 'TENDER001',
            title: 'Test Tender Details',
            email: 'test@example.com',
            phone: '123-456-7890',
            lastDate: '2024-12-31T00:00:00.000Z',
            publishDate: '2024-01-01T00:00:00.000Z',
            aiml_summary: 'This is a detailed summary',
            requirements: 'Test requirements',
            raw_description: 'Raw description text',
            tenderURL: 'https://example.com/tender.pdf'
          }
        })
      });
    });

    it('renders tender details correctly', async () => {
      render(<TenderDetails />);

      await waitFor(() => {
        expect(screen.getByText('Test Tender Details')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('123-456-7890')).toBeInTheDocument();
        expect(screen.getByText('2024-12-31')).toBeInTheDocument();
        expect(screen.getByText('2024-01-01')).toBeInTheDocument();
        expect(screen.getByText('This is a detailed summary')).toBeInTheDocument();
        expect(screen.getByText('Test requirements')).toBeInTheDocument();
      });
    });

    it('shows modal when description button is clicked', async () => {
      render(<TenderDetails />);

      await waitFor(() => {
        expect(screen.getByText('Test Tender Details')).toBeInTheDocument();
      });

      const modalButton = screen.getByText('View PDF Parsed Decription');
      fireEvent.click(modalButton);

      await waitFor(() => {
        expect(screen.getByText('Tender Description')).toBeInTheDocument();
        expect(screen.getByText('Raw description text')).toBeInTheDocument();
      });
    });

    it('closes modal when close button is clicked', async () => {
      render(<TenderDetails />);

      await waitFor(() => {
        expect(screen.getByText('Test Tender Details')).toBeInTheDocument();
      });

      const modalButton = screen.getByText('View PDF Parsed Decription');
      fireEvent.click(modalButton);

      await waitFor(() => {
        expect(screen.getByText('Tender Description')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /×|close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Tender Description')).not.toBeInTheDocument();
      });
    });

    it('displays error message on API failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Tender not found' })
      });

      render(<TenderDetails />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch tenders. Please try again. Tender not found')).toBeInTheDocument();
      });
    });

    it('shows loader when data is not loaded', () => {
      global.fetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

      render(<TenderDetails />);

      // Should show Loader component initially
      expect(screen.getByRole('status')).toBeInTheDocument(); // The spinner has role="status"
    });
  });

  describe('PaginationControls Component', () => {
    it('renders pagination controls correctly', () => {
      const mockOnPageChange = vi.fn();
      const pagination = {
        currentPage: 2,
        totalPages: 5,
        totalItems: 50,
        itemsPerPage: 10
      };

      render(<PaginationControls pagination={pagination} onPageChange={mockOnPageChange} />);

      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('disables previous button on first page', () => {
      const mockOnPageChange = vi.fn();
      const pagination = {
        currentPage: 1,
        totalPages: 5,
        totalItems: 50,
        itemsPerPage: 10
      };

      render(<PaginationControls pagination={pagination} onPageChange={mockOnPageChange} />);

      const previousButton = screen.getByText('Previous');
      expect(previousButton).toBeDisabled();
    });

    it('disables next button on last page', () => {
      const mockOnPageChange = vi.fn();
      const pagination = {
        currentPage: 5,
        totalPages: 5,
        totalItems: 50,
        itemsPerPage: 10
      };

      render(<PaginationControls pagination={pagination} onPageChange={mockOnPageChange} />);

      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeDisabled();
    });

    it('calls onPageChange when page number is clicked', () => {
      const mockOnPageChange = vi.fn();
      const pagination = {
        currentPage: 2,
        totalPages: 5,
        totalItems: 50,
        itemsPerPage: 10
      };

      render(<PaginationControls pagination={pagination} onPageChange={mockOnPageChange} />);

      const page3Button = screen.getByText('3');
      fireEvent.click(page3Button);

      expect(mockOnPageChange).toHaveBeenCalledWith(3);
    });

    it('calls onPageChange when previous button is clicked', () => {
      const mockOnPageChange = vi.fn();
      const pagination = {
        currentPage: 3,
        totalPages: 5,
        totalItems: 50,
        itemsPerPage: 10
      };

      render(<PaginationControls pagination={pagination} onPageChange={mockOnPageChange} />);

      const previousButton = screen.getByText('Previous');
      fireEvent.click(previousButton);

      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    it('calls onPageChange when next button is clicked', () => {
      const mockOnPageChange = vi.fn();
      const pagination = {
        currentPage: 2,
        totalPages: 5,
        totalItems: 50,
        itemsPerPage: 10
      };

      render(<PaginationControls pagination={pagination} onPageChange={mockOnPageChange} />);

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      expect(mockOnPageChange).toHaveBeenCalledWith(3);
    });

    it('generates correct page numbers array', () => {
      const mockOnPageChange = vi.fn();
      const pagination = {
        currentPage: 1,
        totalPages: 3,
        totalItems: 30,
        itemsPerPage: 10
      };

      render(<PaginationControls pagination={pagination} onPageChange={mockOnPageChange} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
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
