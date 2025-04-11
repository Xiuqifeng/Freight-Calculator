import { useState } from "react";
import { Button, TextField, Checkbox, FormControlLabel } from "@mui/material";
import axios from "axios";
import "./App.css";

// Helper to simplify carrier names
const formatCarrierName = (name) => {
  if (name.includes("R+L")) return "R+L";
  if (name.includes("Estes")) return "Estes";
  return name;
};

export default function FreightForm() {
  const [items, setItems] = useState([{ id: 1, sku: "", qty: "" }]);
  const [destination, setDestination] = useState({
    address1: "",
    address2: "",
    city: "",
    state: "",
    zipcode: "",
  });
  const [warehouses, setWarehouses] = useState({ ca: false, al: false });
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    setItems([...items, { id: items.length + 1, sku: "", qty: "" }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index][field] = value;
    setItems(updatedItems);
  };

  const handleDestinationChange = (field, value) => {
    setDestination((prev) => ({ ...prev, [field]: value }));
  };

  const handleWarehouseChange = (warehouse) => {
    setWarehouses((prev) => ({ ...prev, [warehouse]: !prev[warehouse] }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!warehouses.ca && !warehouses.al) {
      newErrors.warehouses = "At least one warehouse must be selected.";
    }
    if (!destination.zipcode) {
      newErrors.zipcode = "Zip Code is required.";
    }
    if (items.length === 0 || items.every(item => !item.sku || !item.qty)) {
      newErrors.items = "At least one item with SKU and Quantity is required.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await axios.post("https://freight-calculator.onrender.com/calculate", {
        items: items.map(({ sku, qty }) => ({
          sku,
          qty: parseInt(qty) || 0,
        })),
        warehouses: Object.keys(warehouses).filter((key) => warehouses[key]),
        destination,
      });

      setResult(response.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderQuoteList = (quotes) =>
    quotes.length > 0 ? (
      <ul>
        {quotes.map((q, i) => (
          <li key={i}>
            {formatCarrierName(q.carrier)}: ${q.total.toFixed(2)}
          </li>
        ))}
      </ul>
    ) : (
      <p>No freight quotes available.</p>
    );

  return (
    <div>
      <header className="header">
        <img src={require("./ICOOLLOGO.png")} alt="ICOOL Logo" className="logo" />
        <h1 className="header-title">Freight Calculator</h1>
      </header>

      <main className="container">
        <h2 className="title">Freight Entry Form</h2>

        <section className="section">
          <h3 className="section-title">SHIP FROM</h3>
          <FormControlLabel
            control={<Checkbox checked={warehouses.ca} onChange={() => handleWarehouseChange("ca")} />}
            label="CA Warehouse"
          />
          <FormControlLabel
            control={<Checkbox checked={warehouses.al} onChange={() => handleWarehouseChange("al")} />}
            label="AL Warehouse"
          />
          {errors.warehouses && <p className="error-text">{errors.warehouses}</p>}
        </section>

        <section className="section">
          <h3 className="section-title">SHIP TO</h3>
          <TextField
            label="Zip Code"
            fullWidth
            value={destination.zipcode}
            onChange={(e) => handleDestinationChange("zipcode", e.target.value)}
            error={!!errors.zipcode}
            helperText={errors.zipcode}
          />
        </section>

        <section className="section">
          <h3 className="section-title">ITEMS</h3>
          {items.map((item, index) => (
            <div key={item.id} className="item-row">
              <TextField
                label="SKU"
                value={item.sku}
                onChange={(e) => handleItemChange(index, "sku", e.target.value)}
              />
              <TextField
                label="Quantity"
                type="number"
                value={item.qty}
                onChange={(e) => handleItemChange(index, "qty", e.target.value)}
              />
              <button onClick={() => removeItem(index)} className="rect-minus-button">
                Remove
              </button>
            </div>
          ))}
          {errors.items && <p className="error-text">{errors.items}</p>}
          <div className="add-item-wrapper">
            <button onClick={addItem} className="rect-plus-button">
              Add Item
            </button>
          </div>
        </section>

        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={handleSubmit}
          disabled={loading}
          className="submit-button"
        >
          {loading ? <div className="spinner" /> : "Submit"}
        </Button>

        {result && (
          <section className="section result">
            <h3>Results</h3>

            <div className="result-box">
              <p><strong>Total Space:</strong> {result.totalSpaces}</p>
              <p><strong>Total Pallets:</strong> {result.totalPallets}</p>
              <p><strong>Total Weight:</strong> {result.totalWeight} lbs</p>
            </div>

            {warehouses.ca && warehouses.al ? (
              <div className="warehouse-quotes">
                <div className="quote-box">
                  <h4>CA Warehouse Quotes</h4>
                  {renderQuoteList(result.freightQuotes?.filter((q) => q.origin === "CA") || [])}
                </div>
                <div className="quote-box">
                  <h4>AL Warehouse Quotes</h4>
                  {renderQuoteList(result.freightQuotes?.filter((q) => q.origin === "AL") || [])}
                </div>
              </div>
            ) : (
              <div className="quote-box">
                <h4>{warehouses.ca ? "CA" : "AL"} Warehouse Quotes</h4>
                {renderQuoteList(result.freightQuotes || [])}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} ICOOL. All rights reserved.</p>
      </footer>
    </div>
  );
}







