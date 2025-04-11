require('dotenv').config();  // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const db = require('./database'); // Import the database

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

const AL_WAREHOUSE = '35640';
const CA_WAREHOUSE = '95828';
const FREIGHTVIEW_API_KEY = process.env.FREIGHTVIEW_API_KEY;

app.post('/calculate', async (req, res) => {
    const { items, warehouses, destination } = req.body;

    if (!items || !destination || !Array.isArray(warehouses) || warehouses.length === 0) {
        return res.status(400).json({ error: 'Missing required parameters: items, destination, or warehouse' });
    }

    let totalPallets = 0;
    let totalWeight = 0;
    let totalSpaces = 0;
    const pickupDate = '2025-03-01';
    const freightClass = 175;
    const freightQuotes = [];

    try {
        // Process all items to get total pallets, weight, and spaces
        let stackablePallets = 0;
        let nonStackablePallets = 0;
        let totalWeight = 0;
        const specialBoxSizes = ['Box5', 'Box6', 'Box6O', 'Box8', 'Box10', 'Box12'];

        for (const item of items) {
            const { sku, qty } = item;

            const row = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM skus WHERE sku = ?', [sku], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!row) {
                return res.status(400).json({ error: `SKU ${sku} not found in database` });
            }

            const palletsForItem = Math.ceil(qty / row.pallets_per_box);
            totalPallets += palletsForItem;
            const weightForItem = Math.ceil(qty * row.weight_per_sku);
            totalWeight += weightForItem;

            if (specialBoxSizes.includes(row.box_size)) {
                stackablePallets += palletsForItem;
                totalSpaces += palletsForItem / 2;
            } else {
                nonStackablePallets += palletsForItem;
                totalSpaces += palletsForItem;
            }
        }

        totalSpaces = Math.ceil(totalSpaces); // Round up

        // For each warehouse, build shipmentData based on stackable and non-stackable
        for (const warehouse of warehouses) {
            let originPostalCode;
            let warehouseLabel;

            if (warehouse.toLowerCase() === 'ca') {
                originPostalCode = CA_WAREHOUSE;
                warehouseLabel = 'CA';
            } else if (warehouse.toLowerCase() === 'al') {
                originPostalCode = AL_WAREHOUSE;
                warehouseLabel = 'AL';
            } else {
                continue;
            }

            const itemsArray = [];

            if (stackablePallets > 0) {
                itemsArray.push({
                    weight: totalWeight, // optional: divide based on pallet types if needed
                    freightClass: freightClass,
                    length: 48,
                    width: 40,
                    height: 40,
                    package: 'Pallets_48x40',
                    pieces: stackablePallets,
                    stackable: true,
                });
            }

            if (nonStackablePallets > 0) {
                itemsArray.push({
                    weight: totalWeight, // optional: divide based on pallet types if needed
                    freightClass: freightClass,
                    length: 48,
                    width: 40,
                    height: 80,
                    package: 'Pallets_48x40',
                    pieces: nonStackablePallets,
                    stackable: false,
                });
            }

            const shipmentData = {
                pickupDate,
                originPostalCode,
                destPostalCode: destination.zipcode,
                items: itemsArray,
            };

            try {
                const response = await axios.post('https://www.freightview.com/api/v1.0/rates', shipmentData, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${Buffer.from(FREIGHTVIEW_API_KEY + ':').toString('base64')}`,
                    },
                });
            
                const rates = response.data.rates;
            
                // Filter for R+L Carriers and Estes Express Lines
                const carriersToKeep = ['R+L Carriers', 'Estes Express Lines'];
            
                for (const carrier of carriersToKeep) {
                    const carrierRates = rates
                        .filter(rate => rate.carrier === carrier)
                        .sort((a, b) => a.total - b.total); // Sort by price ascending
            
                    if (carrierRates.length > 0) {
                        const lowest = carrierRates[0];
                        freightQuotes.push({
                            carrier: lowest.carrier,
                            total: lowest.total,
                            origin: warehouseLabel,
                        });
                    }
                }
            
            } catch (apiError) {
                console.error(`Error fetching quote from ${warehouseLabel}:`, apiError.message);
            }            
        }

        return res.json({
            totalPallets,
            totalWeight,
            totalSpaces,
            freightQuotes,
        });

    } catch (error) {
        console.error('Error calculating freight:', error);
        return res.status(500).json({ error: 'Error calculating freight', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});











