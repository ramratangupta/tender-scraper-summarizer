import React, { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useParams,
} from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { Modal, Button } from "react-bootstrap";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:2900/api';
function TenderList() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    tenderId: "",
    keywords: "",
    startDate: "",
    endDate: "",
  });

  const fetchTenders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();

      if (filters.keywords) params.append("keywords", filters.keywords);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.tenderId) params.append("tenderId", filters.tenderId);
      if (pagination.currentPage) params.append("page", pagination.currentPage);

      const response = await fetch(
        `${apiUrl}/tenders?${params.toString()}`
      );
      const data = await response.json();
      setList(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError("Failed to fetch tenders. Please try again.");
      console.error("Error fetching tenders:", err);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.currentPage]);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prevFilters) => ({
      ...prevFilters,
      [name]: value,
    }));
  };

  // Effect to trigger API call when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => fetchTenders(), 1000);
    return () => clearTimeout(timeoutId);
  }, [filters, pagination.currentPage]);

  // Function to clear all filters
  const clearFilters = () => {
    setFilters({
      tenderId: "",
      keywords: "",
      startDate: "",
      endDate: "",
    });
  };

  useEffect(() => {
    fetchTenders();
    return () => {
      console.log("unmounting");
      setList([]);
      setPagination({});
    };
  }, []);
  const handlePageChange = (newPage) => {
    // Update your existing pagination state
    setPagination((prev) => ({
      ...prev,
      currentPage: newPage,
    }));
  };
  return (
    <div className="ms-1 me-1">
      <h1>IIT Delhi Tender List</h1>
      <div className="row">
        <div className="col-3">
          <input
            type="text"
            name="tenderId"
            placeholder="Search by Tender ID"
            value={filters.tenderId}
            onChange={handleFilterChange}
            className="form-control"
          />
        </div>
        <div className="col-3">
          <input
            type="text"
            name="keywords"
            placeholder="Search by keywords"
            value={filters.keywords}
            onChange={handleFilterChange}
            className="form-control"
          />
        </div>
        <div className="col-3">
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            className="form-control"
          />
        </div>
        <div className="col-3">
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            className="col-2 form-control"
          />
        </div>
      </div>
      <div className="row mt-3 mb-3">
        <div className="col">
          <button onClick={clearFilters} className="btn btn-primary float-end">
            Clear Filters
          </button>
          {error && <div className="col error-message">{error}</div>}
          {loading && <Loader />}
        </div>
      </div>
      <div className="row p-2 text-bg-dark">
        <div className="col-2 fw-bold">
          <span className="float-start">Tender ID</span>
        </div>
        <div className="col-2 fw-bold">
          <span className="float-start">Title</span>
        </div>
        <div className="col-4 fw-bold">
          <span className="float-start">Summary</span>
        </div>
        <div className="col-2 fw-bold">
          <span className="float-start">Last Date</span>
        </div>
        <div className="col-2 fw-bold">
          <span className="float-end">View Details</span>
        </div>
      </div>
      <PaginationControls
        pagination={pagination}
        onPageChange={handlePageChange}
      />
      {list.map((tender, i) => {
        return (
          <div
            className={`row p-2 ${i % 2 === 0 ? "text-bg-light" : ""}`}
            key={tender.tenderid}
          >
            <div className="col-2">{tender.tenderid}</div>
            <div className="col-2">{tender.title}</div>
            <div className="col-4">{tender.aiml_summary}</div>
            <div className="col-2">{tender.lastDate.split("T")[0]}</div>
            <div className="col-2">
              <Link
                className="btn btn-primary float-end"
                to={`/tender/${tender.tenderid}`}
              >
                View
              </Link>
            </div>
          </div>
        );
      })}
      <PaginationControls
        pagination={pagination}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

function TenderDetails() {
  const { id } = useParams();
  const [tenderData, setTenderData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  useEffect(() => {
    // Fetch tender details using the id
    const fetchTenderDetails = async () => {
      try {
        const response = await fetch(`${apiUrl}/tenders/${id}`);
        const data = await response.json();
        setTenderData(data.data);
      } catch (error) {
        console.error("Error fetching tender details:", error);
      }
    };

    fetchTenderDetails();
    return () => {
      console.log("unmounting");
      setTenderData(null);
    };
  }, [id]);
  return tenderData == null ? (
    <Loader />
  ) : (
    <div>
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="lg"
        aria-labelledby="description-modal"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title id="description-modal">Tender Description</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ whiteSpace: "pre-wrap" }}>
            {tenderData.raw_description}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowModal(false)}
          ></Button>
        </Modal.Footer>
      </Modal>
      <div className="row">
        <div className="col-10">
          <h2>{tenderData.title}</h2>
        </div>

        <div className="col-2">
          <Link className="btn btn-primary float-end" to="/">
            Back
          </Link>
        </div>
      </div>
      <div className="row">
        <div className="col">
          <h4>Email</h4>
          <p>{tenderData.email}</p>
        </div>
        <div className="col">
          <h4>Contact Numbers</h4>
          <p>{tenderData.phone}</p>
        </div>
      </div>
      <div className="row">
        <div className="col">
          <h4>Last Date</h4>
          <p>{tenderData.lastDate.split("T")[0]}</p>
        </div>
        <div className="col">
          <h4>Publish Date</h4>
          <p>{tenderData.publishDate.split("T")[0]}</p>
        </div>
      </div>
      <div className="row">
        <div className="col-12">
          <h3>Summary</h3>
          <p>{tenderData.aiml_summary}</p>
        </div>
      </div>
      <div className="row">
        <div className="col-12">
          <h3>Requirements</h3>
          <p>{tenderData.requirements}</p>
        </div>
      </div>

      <div className="row">
        <div className="col">
          <Link
            target="_blank"
            className="btn btn-primary float-end"
            to={tenderData.tenderURL}
          >
            View PDF
          </Link>
          <Button
            className="btn btn-primary float-end me-4"
            onClick={() => setShowModal(true)}
          >
            View PDF Parsed Decription
          </Button>
        </div>
      </div>
    </div>
  );
}

// Create the main App component with routing
function App() {
  return (
    <BrowserRouter>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-fluid">
          <Link className="navbar-brand" to="/">
            IIT Delhi Tenders
          </Link>
        </div>
      </nav>

      <div className="container mt-3">
        <Routes>
          <Route path="/" element={<TenderList />} />
          <Route path="/tender/:id" element={<TenderDetails />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
function Loader() {
  return (
    <div className="d-flex justify-content-center">
      <div className="spinner-border" role="status">
        <span className="sr-only"></span>
      </div>
    </div>
  );
}
const PaginationControls = ({ pagination, onPageChange }) => {
  const { currentPage, totalPages } = pagination;

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Generate page numbers array
  const getPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <nav aria-label="Tender pagination" className="mt-4">
      <ul className="pagination justify-content-center">
        {/* Previous Button */}
        <li className={`page-item ${currentPage === 1 || totalPages==0 ? "disabled" : ""}`}>
          <button
            className="page-link"
            onClick={handlePrevious}
            disabled={currentPage === 1}
          >
            Previous
          </button>
        </li>

        {/* Page Numbers */}
        {getPageNumbers().map((pageNum) => (
          <li
            key={pageNum}
            className={`page-item ${pageNum === currentPage ? "active" : ""}`}
          >
            <button className="page-link" onClick={() => onPageChange(pageNum)}>
              {pageNum}
            </button>
          </li>
        ))}

        {/* Next Button */}
        <li
          className={`page-item ${
            currentPage === totalPages || totalPages==0 ? "disabled" : ""
          }`}
        >
          <button
            className="page-link"
            onClick={handleNext}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </li>
      </ul>
    </nav>
  );
};
export default App;
