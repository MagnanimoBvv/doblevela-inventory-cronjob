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
    const shopifyProducts = await paginateProductsByVendor('Doble Vela');

    const locationId = await getLocationId();
    for (const shopifyProduct of shopifyProducts) {
        // if (model !== 'A2558') continue; // If para pruebas con un producto específico
        try {
            const handle = shopifyProduct.handle.replace('dv-', '').replace(/-/g, ' ').toUpperCase();
            const responseProduct = await getDobleVelaProduct(handle);
            if (responseProduct.intCodigo !== 0) {
                continue;
            }
            const activeVariants = responseProduct.Resultado;

            const shopifyVariants = shopifyProduct.variants.nodes;
            for (const activeVariant of activeVariants) {
                const variant = shopifyVariants.find(v => v.sku === activeVariant.CLAVE);
                const variantInventory = warehouses.reduce((acum, warehouse) => acum + activeVariant[warehouse], 0);
                console.log(`Variante encontrada: ${shopifyProduct.title} ${variant.title}, Inventario: Prev ${variant.inventoryQuantity} Now ${variantInventory}`);

                if (variant.inventoryQuantity !== variantInventory) {
                    const variantToUpdate = {
                        quantities: {
                            changeFromQuantity: null,
                            inventoryItemId: variant.inventoryItem.id,
                            locationId,
                            quantity: variantInventory,
                        },
                        name: "available",
                        reason: "correction",
                    };
                    const response = await updateInventory(variantToUpdate);
                    console.log('Inventario actualizado:', response.changes);
                }
            }
            // break;
        } catch (error) {
            console.error(`Error actualizando el producto ${shopifyProduct.title}:`, error);
        }
    }
}

updateProducts();