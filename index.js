require('dotenv').config();
const axios = require('axios');
const { getLocationId, paginateProductsByVendor, updateInventory } = require('./shopifyFunctions');

const warehouses = [
    'Disponible Almacen 7',
    'Disponible Almacen 9',
    'Disponible Almacen 15',
    'Disponible Almacen 20',
    'Disponible Almacen 24',
];

async function getDobleVelaProduct(code) {
    const response = await axios.get(
        'http://srv-datos.dyndns.info/doblevela/service.asmx/GetExistencia',
        {
            params: {
                codigo: code,
                Key: process.env.DV_KEY,
            },
        }
    );

    return JSON.parse(response.data.match(/<string[^>]*>(.*)<\/string>/s)[1]);
}

async function updateProducts() {
    const locationId = await getLocationId();
    const shopifyProducts = await paginateProductsByVendor('Doble Vela');
    for (const shopifyProduct of shopifyProducts) {
        // if (model !== 'A2558') continue; // If para pruebas con un producto específico
        try {
            const handle = shopifyProduct.handle.replace('dv-', '').replace(/-/g, ' ').toUpperCase();
            const responseProduct = await getDobleVelaProduct(handle);
            if (responseProduct.intCodigo !== 0) continue;

            const shopifyVariants = shopifyProduct.variants.nodes;
            const activeVariants = responseProduct.Resultado;
            const activeVariantBySKU = new Map(activeVariants.map(v => [v.CLAVE, v]));

            for (const variant of shopifyVariants) {
                const activeVariant = activeVariantBySKU.get(variant.sku);
                const targetInventory = activeVariant ? warehouses.reduce((acum, warehouse) => acum + activeVariant[warehouse], 0) : 0;
                const label = activeVariant ? 'Variante existente' : 'Variante faltante';
                console.log(`${label}: ${shopifyProduct.title} ${variant.title}, Prev ${variant.inventoryQuantity} Now ${targetInventory}`);

                if (variant.inventoryQuantity === targetInventory) continue;

                const variantToUpdate = {
                    quantities: {
                        changeFromQuantity: null,
                        inventoryItemId: variant.inventoryItem.id,
                        locationId,
                        quantity: targetInventory,
                    },
                    name: "available",
                    reason: "correction",
                };
                const response = await updateInventory(variantToUpdate);
                console.log('Inventario actualizado:', response.changes);
            }
            // break;
        } catch (error) {
            console.error(`Error actualizando ${shopifyProduct.title}:`, error);
        }
    }
}

updateProducts();