import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useParams,
} from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { Modal, Button } from "react-bootstrap";
function TenderList() {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({});
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("http://localhost:2900/api/tenders");
        const data = await response.json();
        setList(data.data);
        setPagination(data.pagination);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
    return () => {
      console.log("unmounting");
      setList([]);
    };
  }, []);
  return (
    <div className="ms-1 me-1">
      <h1>IIT Delhi Tender List</h1>
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
      {list.map((tender, i) => {
        return (
          <div
            className={`row p-2 ${i % 2 == 0 ? "text-bg-light" : ""}`}
            key={tender.tenderid}
          >
            <div className="col-2">{tender.tenderid}</div>
            <div className="col-2">{tender.title}</div>
            <div className="col-4">{tender.aiml_summary}</div>
            <div className="col-2">{tender.lastdate}</div>
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
        const response = await fetch(`http://localhost:2900/api/tenders/${id}`);
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
        onHide={()=>setShowModal(false)}
        size="lg"
        aria-labelledby="description-modal"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title id="description-modal">Tender Description</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ whiteSpace: "pre-wrap" }}>{tenderData.raw_description}</div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={()=>setShowModal(false)}>
          </Button>
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
          <p>{tenderData.lastDate}</p>
        </div>
        <div className="col">
          <h4>Publish Date</h4>
          <p>{tenderData.publishDate}</p>
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
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}
export default App;
