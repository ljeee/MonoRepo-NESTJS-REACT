const fs = require('fs');

const newStateMachineCode = `const parseData = $('Parse WA Payload').first().json;
const redisData = $('Redis Get Session').first().json;
const products = $('Get Products').all().map(i => i.json).flat().filter(p => p && p.productoId);
const sabores = $('Get Sabores').all().map(i => i.json).flat().filter(s => s && s.nombre);

const phone = parseData.phone;
const msgType = parseData.msgType;
const msgBody = parseData.body;
const buttonId = parseData.buttonId;
const listId = parseData.listId;

let session;
try {
  session = redisData.value ? JSON.parse(redisData.value) : null;
} catch(e) {
  session = null;
}

if (!session || !session.step) {
  session = {
    step: 'await_tipo',
    productPage: 0,
    tipoPedido: null,
    nombreCliente: null,
    telefonoCliente: phone,
    direccionCliente: null,
    metodoPago: null,
    observaciones: null,
    cart: [],
    cur: {}
  };
}

function fmt(n) { return '$' + Number(n).toLocaleString('es-CO'); }

function cartSummary(cart) {
  if (!cart.length) return 'El carrito esta vacio.';
  return cart.map((item, i) => {
    let line = \`\${i+1}. \${item.productoNombre} \${item.varianteNombre || ''} x\${item.cantidad}\`;
    if (item.sabor1) line += \` [\${[item.sabor1, item.sabor2, item.sabor3].filter(Boolean).join('/')}]\`;
    line += \` = \${fmt(item.subtotal)}\`;
    return line;
  }).join('\\n');
}

function cartTotal(cart) {
  return cart.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
}

function btnMsg(body, buttons, header) {
  const msg = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: String(body).substring(0, 1024) },
      action: { buttons }
    }
  };
  if (header) msg.interactive.header = { type: 'text', text: String(header).substring(0, 60) };
  return msg;
}

function listMsg(body, sections, buttonText, header) {
  const msg = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: String(body).substring(0, 1024) },
      action: {
        button: String(buttonText || 'Ver opciones').substring(0, 20),
        sections
      }
    }
  };
  if (header) msg.interactive.header = { type: 'text', text: String(header).substring(0, 60) };
  return msg;
}

function textMsg(text) {
  return {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: String(text).substring(0, 4096) }
  };
}

function activeVariants(product) {
  return (product.variantes || []).filter(v => v.activo !== false);
}

function buildProductButtonsMsg(page) {
  const active = products.filter(p => p.activo !== false);
  if (!active.length) return textMsg("Lo sentimos, no hay productos disponibles. Contactanos directamente.");

  if (active.length <= 3) {
    return btnMsg(
      '?Que deseas ordenar?',
      active.map(p => ({
        type: 'reply',
        reply: { id: \`prod_\${p.productoId}\`, title: ((p.emoji ? p.emoji + ' ' : '') + p.productoNombre).substring(0, 20) }
      })),
      "Menu D'Firu"
    );
  }

  const startIdx = page * 2;
  const pageProducts = active.slice(startIdx, startIdx + 2);
  const hasMore = startIdx + 2 < active.length;
  const buttons = pageProducts.map(p => ({
    type: 'reply',
    reply: { id: \`prod_\${p.productoId}\`, title: ((p.emoji ? p.emoji + ' ' : '') + p.productoNombre).substring(0, 20) }
  }));
  if (hasMore) {
    buttons.push({ type: 'reply', reply: { id: \`prod_page_\${page + 1}\`, title: 'Ver mas' } });
  } else if (page > 0) {
    buttons.push({ type: 'reply', reply: { id: 'prod_page_0', title: 'Inicio menu' } });
  }
  return btnMsg(\`?Que deseas ordenar? (\${startIdx + 1}-\${Math.min(startIdx + 2, active.length)} de \${active.length})\`, buttons, "Menu D'Firu");
}

function buildSaboresListMsg(label) {
  const tradicionales = sabores.filter(s => s.activo !== false && s.tipo === 'tradicional');
  const especiales = sabores.filter(s => s.activo !== false && s.tipo !== 'tradicional');
  const toRow = s => ({
    id: \`sab_\${s.nombre.replace(/\\s+/g, '_')}\`,
    title: s.nombre.substring(0, 24),
    description: s.tipo !== 'tradicional' ? \`Especial +\${fmt(s.recargoGrande || 0)}\` : 'Sabor clasico'
  });
  const sections = [];
  if (tradicionales.length) sections.push({ title: 'Sabores Clasicos', rows: tradicionales.slice(0, 10).map(toRow) });
  if (especiales.length) sections.push({ title: 'Sabores Especiales', rows: especiales.slice(0, 10).map(toRow) });
  if (!sections.length) sections.push({ title: 'Sabores', rows: [{ id: 'sab_Clasica', title: 'Clasica', description: 'Sabor de la casa' }] });
  return listMsg(label || 'Elige un sabor:', sections, 'Ver Sabores', 'Sabores Pizza');
}

let waPayload = null;
let needsOrderCreation = false;
let orderData = null;
let updatedSession = JSON.parse(JSON.stringify(session));

const step = session.step || 'await_tipo';
const cur = session.cur || {};

if (step === 'await_tipo') {
  waPayload = btnMsg(
    "Bienvenido a *D'Firu Pizza*!\\n\\nComo deseas tu pedido?",
    [
      { type: 'reply', reply: { id: 'tipo_mesa', title: 'En Mesa' } },
      { type: 'reply', reply: { id: 'tipo_llevar', title: 'Para Llevar' } },
      { type: 'reply', reply: { id: 'tipo_domicilio', title: 'Domicilio' } }
    ],
    "D'Firu Pizza"
  );
  updatedSession.step = 'await_tipo_select';
}

else if (step === 'await_tipo_select') {
  if (buttonId === 'tipo_mesa') {
    updatedSession.tipoPedido = 'mesa';
    updatedSession.productPage = 0;
    updatedSession.step = 'await_product';
    waPayload = buildProductButtonsMsg(0);
  } else if (buttonId === 'tipo_llevar') {
    updatedSession.tipoPedido = 'llevar';
    updatedSession.step = 'await_nombre';
    waPayload = textMsg('Escribe tu *nombre* para identificar tu pedido:');
  } else if (buttonId === 'tipo_domicilio') {
    updatedSession.tipoPedido = 'domicilio';
    updatedSession.step = 'await_nombre';
    waPayload = textMsg('Escribe tu *nombre completo*:');
  } else {
    waPayload = btnMsg(
      'Selecciona como deseas tu pedido:',
      [
        { type: 'reply', reply: { id: 'tipo_mesa', title: 'En Mesa' } },
        { type: 'reply', reply: { id: 'tipo_llevar', title: 'Para Llevar' } },
        { type: 'reply', reply: { id: 'tipo_domicilio', title: 'Domicilio' } }
      ]
    );
  }
}

else if (step === 'await_nombre') {
  if (msgType === 'text' && msgBody && msgBody.trim().length >= 2) {
    updatedSession.nombreCliente = msgBody.trim();
    if (session.tipoPedido === 'domicilio') {
      updatedSession.step = 'await_direccion';
      waPayload = textMsg('Escribe la *direccion de entrega*:');
    } else {
      updatedSession.productPage = 0;
      updatedSession.step = 'await_product';
      waPayload = buildProductButtonsMsg(0);
    }
  } else {
    waPayload = textMsg('Escribe tu nombre (minimo 2 caracteres):');
  }
}

else if (step === 'await_direccion') {
  if (msgType === 'text' && msgBody && msgBody.trim().length >= 5) {
    updatedSession.direccionCliente = msgBody.trim();
    updatedSession.productPage = 0;
    updatedSession.step = 'await_product';
    waPayload = buildProductButtonsMsg(0);
  } else {
    waPayload = textMsg('Escribe la *direccion completa* (minimo 5 caracteres):');
  }
}

else if (step === 'await_product') {
  const input = buttonId || listId;

  if (buttonId && buttonId.startsWith('prod_page_')) {
    const newPage = parseInt(buttonId.replace('prod_page_', ''), 10);
    updatedSession.productPage = newPage;
    waPayload = buildProductButtonsMsg(newPage);
  } else if (buttonId === 'prod_page_0') {
    updatedSession.productPage = 0;
    waPayload = buildProductButtonsMsg(0);
  } else if (input && input.startsWith('prod_')) {
    const prodId = parseInt(input.replace('prod_', ''), 10);
    const product = products.find(p => p.productoId === prodId);
    if (product) {
      const isPizza = product.productoNombre.toLowerCase().includes('pizza');
      const variants = activeVariants(product);
      updatedSession.cur = {
        productoId: product.productoId,
        productoNombre: product.productoNombre,
        tipo: isPizza ? 'Pizza' : product.productoNombre,
        isPizza,
        varianteId: null, varianteNombre: null, variantePrecio: 0,
        sabor1: null, sabor2: null, sabor3: null, cantidad: 1
      };
      if (variants.length === 0) {
        waPayload = textMsg(\`Lo sentimos, \${product.productoNombre} no esta disponible.\`);
      } else if (variants.length === 1) {
        updatedSession.cur.varianteId = variants[0].varianteId;
        updatedSession.cur.varianteNombre = variants[0].nombre;
        updatedSession.cur.variantePrecio = Number(variants[0].precio) || 0;
        if (isPizza) {
          updatedSession.step = 'await_sabor1';
          waPayload = buildSaboresListMsg(\`Elige el primer sabor de tu *\${product.productoNombre} \${variants[0].nombre}*:\`);
        } else {
          updatedSession.step = 'await_qty';
          waPayload = btnMsg(
            \`*\${product.productoNombre}*\\nPrecio: \${fmt(variants[0].precio)}\\n\\nCuantas unidades?\`,
            [
              { type: 'reply', reply: { id: 'qty_1', title: '1 unidad' } },
              { type: 'reply', reply: { id: 'qty_2', title: '2 unidades' } },
              { type: 'reply', reply: { id: 'qty_3', title: '3 unidades' } }
            ]
          );
        }
      } else {
        updatedSession.step = isPizza ? 'await_variant_pizza' : 'await_variant_other';
        if (variants.length <= 3) {
          waPayload = btnMsg(
            \`*\${product.productoNombre}*\\n\\nQue tamano/variante deseas?\`,
            variants.slice(0, 3).map(v => ({
              type: 'reply',
              reply: { id: \`var_\${product.productoId}_\${v.varianteId}\`, title: \`\${v.nombre} \${fmt(v.precio)}\`.substring(0, 20) }
            }))
          );
        } else {
          waPayload = listMsg(
            \`*\${product.productoNombre}*\\n\\nSelecciona el tamano:\`,
            [{ title: 'Variantes', rows: variants.slice(0, 10).map(v => ({ id: \`var_\${product.productoId}_\${v.varianteId}\`, title: v.nombre.substring(0, 24), description: fmt(v.precio) })) }],
            'Ver Variantes'
          );
        }
      }
    } else {
      waPayload = buildProductButtonsMsg(session.productPage || 0);
    }
  } else {
    waPayload = buildProductButtonsMsg(session.productPage || 0);
  }
}

else if (step === 'await_variant_pizza' || step === 'await_variant_other') {
  const varRaw = buttonId || listId;
  if (varRaw && varRaw.startsWith('var_')) {
    const parts = varRaw.split('_');
    const pId = parseInt(parts[1], 10);
    const vId = parseInt(parts[2], 10);
    const product = products.find(p => p.productoId === pId || p.productoId === cur.productoId);
    const variant = product ? activeVariants(product).find(v => v.varianteId === vId) : null;
    if (variant) {
      updatedSession.cur = { ...cur, varianteId: variant.varianteId, varianteNombre: variant.nombre, variantePrecio: Number(variant.precio) || 0 };
      if (cur.isPizza) {
        updatedSession.step = 'await_sabor1';
        waPayload = buildSaboresListMsg(\`Elige el primer sabor para tu *\${cur.productoNombre} \${variant.nombre}*:\`);
      } else {
        updatedSession.step = 'await_qty';
        waPayload = btnMsg(
          \`*\${cur.productoNombre} - \${variant.nombre}*\\n\${fmt(variant.precio)}\\n\\nCuantas unidades?\`,
          [
            { type: 'reply', reply: { id: 'qty_1', title: '1 unidad' } },
            { type: 'reply', reply: { id: 'qty_2', title: '2 unidades' } },
            { type: 'reply', reply: { id: 'qty_3', title: '3 unidades' } }
          ]
        );
      }
    } else {
      waPayload = buildProductButtonsMsg(session.productPage || 0);
    }
  }
}

else if (step === 'await_sabor1') {
  if (listId && listId.startsWith('sab_')) {
    const saborNombre = listId.replace('sab_', '').replace(/_/g, ' ');
    updatedSession.cur = { ...cur, sabor1: saborNombre };
    updatedSession.step = 'await_more_s1';
    waPayload = btnMsg(
      \`Sabor 1: *\${saborNombre}* ✓\\n\\nDeseas agregar un segundo sabor?\`,
      [
        { type: 'reply', reply: { id: 'more_s1_yes', title: 'Si, otro sabor' } },
        { type: 'reply', reply: { id: 'more_s1_no', title: 'No, continuar' } }
      ]
    );
  } else {
    waPayload = buildSaboresListMsg('Elige el primer sabor de tu pizza:');
  }
}

else if (step === 'await_more_s1') {
  if (buttonId === 'more_s1_yes') {
    updatedSession.step = 'await_sabor2';
    waPayload = buildSaboresListMsg('Elige el segundo sabor:');
  } else if (buttonId === 'more_s1_no') {
    updatedSession.step = 'await_qty';
    waPayload = btnMsg(
      \`*\${cur.productoNombre} \${cur.varianteNombre}*\\nSabor: \${cur.sabor1}\\n\\nCuantas unidades?\`,
      [
        { type: 'reply', reply: { id: 'qty_1', title: '1 unidad' } },
        { type: 'reply', reply: { id: 'qty_2', title: '2 unidades' } },
        { type: 'reply', reply: { id: 'qty_3', title: '3 unidades' } }
      ]
    );
  } else {
    waPayload = btnMsg(
      'Deseas agregar un segundo sabor?',
      [
        { type: 'reply', reply: { id: 'more_s1_yes', title: 'Si, otro sabor' } },
        { type: 'reply', reply: { id: 'more_s1_no', title: 'No, continuar' } }
      ]
    );
  }
}

else if (step === 'await_sabor2') {
  if (listId && listId.startsWith('sab_')) {
    const saborNombre = listId.replace('sab_', '').replace(/_/g, ' ');
    updatedSession.cur = { ...cur, sabor2: saborNombre };
    updatedSession.step = 'await_more_s2';
    waPayload = btnMsg(
      \`Sabor 1: *\${cur.sabor1}* ✓\\nSabor 2: *\${saborNombre}* ✓\\n\\nDeseas un tercer sabor?\`,
      [
        { type: 'reply', reply: { id: 'more_s2_yes', title: 'Si, tercer sabor' } },
        { type: 'reply', reply: { id: 'more_s2_no', title: 'No, continuar' } }
      ]
    );
  } else {
    waPayload = buildSaboresListMsg('Elige el segundo sabor:');
  }
}

else if (step === 'await_more_s2') {
  if (buttonId === 'more_s2_yes') {
    updatedSession.step = 'await_sabor3';
    waPayload = buildSaboresListMsg('Elige el tercer sabor:');
  } else if (buttonId === 'more_s2_no') {
    updatedSession.step = 'await_qty';
    waPayload = btnMsg(
      \`*\${cur.productoNombre} \${cur.varianteNombre}*\\nSabores: \${cur.sabor1} / \${cur.sabor2}\\n\\nCuantas unidades?\`,
      [
        { type: 'reply', reply: { id: 'qty_1', title: '1 unidad' } },
        { type: 'reply', reply: { id: 'qty_2', title: '2 unidades' } },
        { type: 'reply', reply: { id: 'qty_3', title: '3 unidades' } }
      ]
    );
  } else {
    waPayload = btnMsg(
      'Deseas un tercer sabor?',
      [
        { type: 'reply', reply: { id: 'more_s2_yes', title: 'Si, tercer sabor' } },
        { type: 'reply', reply: { id: 'more_s2_no', title: 'No, continuar' } }
      ]
    );
  }
}

else if (step === 'await_sabor3') {
  if (listId && listId.startsWith('sab_')) {
    const saborNombre = listId.replace('sab_', '').replace(/_/g, ' ');
    updatedSession.cur = { ...cur, sabor3: saborNombre };
    updatedSession.step = 'await_qty';
    const sabTxt = [cur.sabor1, cur.sabor2, saborNombre].filter(Boolean).join(' / ');
    waPayload = btnMsg(
      \`Sabores: \${sabTxt} ✓\\n\\nCuantas unidades?\`,
      [
        { type: 'reply', reply: { id: 'qty_1', title: '1 unidad' } },
        { type: 'reply', reply: { id: 'qty_2', title: '2 unidades' } },
        { type: 'reply', reply: { id: 'qty_3', title: '3 unidades' } }
      ]
    );
  } else {
    waPayload = buildSaboresListMsg('Elige el tercer sabor:');
  }
}

else if (step === 'await_qty') {
  const qtyMap = { qty_1: 1, qty_2: 2, qty_3: 3 };
  const qty = buttonId ? qtyMap[buttonId] : null;
  if (qty) {
    const finalCur = (updatedSession.cur && updatedSession.cur.varianteId) ? updatedSession.cur : cur;
    const subtotal = Number(finalCur.variantePrecio || 0) * qty;
    const cartItem = {
      tipo: finalCur.tipo || finalCur.productoNombre,
      productoId: finalCur.productoId,
      varianteId: finalCur.varianteId,
      productoNombre: finalCur.productoNombre,
      varianteNombre: finalCur.varianteNombre,
      precio: finalCur.variantePrecio,
      sabor1: finalCur.sabor1 || null,
      sabor2: finalCur.sabor2 || null,
      sabor3: finalCur.sabor3 || null,
      cantidad: qty,
      subtotal
    };
    updatedSession.cart = [...(session.cart || []), cartItem];
    updatedSession.cur = {};
    updatedSession.step = 'await_cart';
    const total = cartTotal(updatedSession.cart);
    const summary = cartSummary(updatedSession.cart);
    waPayload = btnMsg(
      \`Agregado!\\n\\n*Tu pedido:*\\n\${summary}\\n\\n*Total: \${fmt(total)}*\`,
      [
        { type: 'reply', reply: { id: 'cart_add', title: 'Agregar mas' } },
        { type: 'reply', reply: { id: 'cart_pay', title: 'Pagar' } }
      ],
      'Carrito'
    );
  } else {
    waPayload = btnMsg(
      'Cuantas unidades deseas?',
      [
        { type: 'reply', reply: { id: 'qty_1', title: '1 unidad' } },
        { type: 'reply', reply: { id: 'qty_2', title: '2 unidades' } },
        { type: 'reply', reply: { id: 'qty_3', title: '3 unidades' } }
      ]
    );
  }
}

else if (step === 'await_cart') {
  if (buttonId === 'cart_add') {
    updatedSession.productPage = 0;
    updatedSession.step = 'await_product';
    updatedSession.cur = {};
    waPayload = buildProductButtonsMsg(0);
  } else if (buttonId === 'cart_pay') {
    updatedSession.step = 'await_pago';
    waPayload = btnMsg(
      \`Total: \${fmt(cartTotal(session.cart))}\\n\\nComo vas a pagar?\`,
      [
        { type: 'reply', reply: { id: 'pago_efectivo', title: 'Efectivo' } },
        { type: 'reply', reply: { id: 'pago_transfer', title: 'Transferencia' } }
      ]
    );
  } else {
    const total = cartTotal(session.cart);
    const summary = cartSummary(session.cart);
    waPayload = btnMsg(
      \`*Tu pedido:*\\n\${summary}\\n\\n*Total: \${fmt(total)}*\`,
      [
        { type: 'reply', reply: { id: 'cart_add', title: 'Agregar mas' } },
        { type: 'reply', reply: { id: 'cart_pay', title: 'Pagar' } }
      ],
      'Carrito'
    );
  }
}

else if (step === 'await_pago') {
  const pagoMap = { pago_efectivo: 'efectivo', pago_transfer: 'transferencia' };
  const metodo = buttonId ? pagoMap[buttonId] : null;
  if (metodo) {
    updatedSession.metodoPago = metodo;
    updatedSession.step = 'await_observaciones';
    waPayload = btnMsg(
      \`Metodo de pago: *\${metodo}* ✓\\n\\n¿Tienes alguna nota especial para tu pedido?\\n(ej: sin cebolla, extra salsa, sin aji)\\n\\nEscribe tu nota o toca *Omitir*:\`,
      [{ type: 'reply', reply: { id: 'skip_obs', title: 'Omitir' } }]
    );
  } else {
    waPayload = btnMsg(
      'Como vas a pagar?',
      [
        { type: 'reply', reply: { id: 'pago_efectivo', title: 'Efectivo' } },
        { type: 'reply', reply: { id: 'pago_transfer', title: 'Transferencia' } }
      ]
    );
  }
}

else if (step === 'await_observaciones') {
  if (buttonId === 'skip_obs') {
    updatedSession.observaciones = null;
    updatedSession.step = 'await_confirm';
    const total = cartTotal(session.cart);
    const summary = cartSummary(session.cart);
    const tipoLabel = { mesa: 'Mesa', llevar: 'Para Llevar', domicilio: 'Domicilio' }[session.tipoPedido] || session.tipoPedido;
    let ct = \`*Confirmar Pedido*\\n\\nTipo: \${tipoLabel}\`;
    if (session.nombreCliente) ct += \`\\nCliente: \${session.nombreCliente}\`;
    if (session.tipoPedido === 'domicilio' && session.direccionCliente) ct += \`\\nDireccion: \${session.direccionCliente}\`;
    ct += \`\\n\\n*Productos:*\\n\${summary}\\n\\n*Total: \${fmt(total)}*\\nPago: \${session.metodoPago}\`;
    waPayload = btnMsg(ct, [
      { type: 'reply', reply: { id: 'confirm_yes', title: 'Confirmar Pedido' } },
      { type: 'reply', reply: { id: 'confirm_no', title: 'Cancelar' } }
    ]);
  } else if (msgType === 'text' && msgBody && msgBody.trim().length >= 1) {
    updatedSession.observaciones = msgBody.trim();
    updatedSession.step = 'await_confirm';
    const total = cartTotal(session.cart);
    const summary = cartSummary(session.cart);
    const tipoLabel = { mesa: 'Mesa', llevar: 'Para Llevar', domicilio: 'Domicilio' }[session.tipoPedido] || session.tipoPedido;
    let ct = \`*Confirmar Pedido*\\n\\nTipo: \${tipoLabel}\`;
    if (session.nombreCliente) ct += \`\\nCliente: \${session.nombreCliente}\`;
    if (session.tipoPedido === 'domicilio' && session.direccionCliente) ct += \`\\nDireccion: \${session.direccionCliente}\`;
    ct += \`\\n\\n*Productos:*\\n\${summary}\\n\\n*Total: \${fmt(total)}*\\nPago: \${session.metodoPago}\`;
    ct += \`\\n*Nota:* \${msgBody.trim()}\`;
    waPayload = btnMsg(ct, [
      { type: 'reply', reply: { id: 'confirm_yes', title: 'Confirmar Pedido' } },
      { type: 'reply', reply: { id: 'confirm_no', title: 'Cancelar' } }
    ]);
  } else {
    waPayload = btnMsg(
      '¿Tienes alguna nota especial?\\nEscribe tu nota o toca *Omitir*:',
      [{ type: 'reply', reply: { id: 'skip_obs', title: 'Omitir' } }]
    );
  }
}

else if (step === 'await_confirm') {
  if (buttonId === 'confirm_yes') {
    orderData = {
      tipoPedido: session.tipoPedido,
      nombreCliente: session.nombreCliente || undefined,
      telefonoCliente: phone,
      direccionCliente: session.tipoPedido === 'domicilio' ? (session.direccionCliente || undefined) : undefined,
      costoDomicilio: session.tipoPedido === 'domicilio' ? 5000 : undefined,
      metodo: session.metodoPago || undefined,
      observaciones: session.observaciones ? \`\${session.observaciones} | WhatsApp: \${phone}\` : \`WhatsApp: \${phone}\`,
      productos: (session.cart || []).map(item => ({
        tipo: item.tipo,
        varianteId: item.varianteId,
        sabor1: item.sabor1 || undefined,
        sabor2: item.sabor2 || undefined,
        sabor3: item.sabor3 || undefined,
        cantidad: item.cantidad
      }))
    };
    needsOrderCreation = true;
    updatedSession = { step: 'await_tipo', productPage: 0, cart: [], tipoPedido: null, nombreCliente: null, telefonoCliente: phone, direccionCliente: null, metodoPago: null, observaciones: null, cur: {} };
    waPayload = null;
  } else if (buttonId === 'confirm_no') {
    updatedSession = { step: 'await_tipo_select', productPage: 0, cart: [], tipoPedido: null, nombreCliente: null, telefonoCliente: phone, direccionCliente: null, metodoPago: null, observaciones: null, cur: {} };
    waPayload = btnMsg(
      'Pedido cancelado.\\n\\nDeseas hacer un nuevo pedido?',
      [
        { type: 'reply', reply: { id: 'tipo_mesa', title: 'En Mesa' } },
        { type: 'reply', reply: { id: 'tipo_llevar', title: 'Para Llevar' } },
        { type: 'reply', reply: { id: 'tipo_domicilio', title: 'Domicilio' } }
      ]
    );
  } else {
    const total = cartTotal(session.cart);
    const summary = cartSummary(session.cart);
    waPayload = btnMsg(
      \`*Tu Pedido:*\\n\${summary}\\n\\n*Total: \${fmt(total)}*\\nPago: \${session.metodoPago}\\n\\nConfirmas?\`,
      [
        { type: 'reply', reply: { id: 'confirm_yes', title: 'Confirmar Pedido' } },
        { type: 'reply', reply: { id: 'confirm_no', title: 'Cancelar' } }
      ]
    );
  }
}

else {
  updatedSession = { step: 'await_tipo_select', productPage: 0, cart: [], tipoPedido: null, nombreCliente: null, telefonoCliente: phone, direccionCliente: null, metodoPago: null, observaciones: null, cur: {} };
  waPayload = btnMsg(
    "Hola! Bienvenido a D'Firu Pizza.\\n\\nComo deseas tu pedido?",
    [
      { type: 'reply', reply: { id: 'tipo_mesa', title: 'En Mesa' } },
      { type: 'reply', reply: { id: 'tipo_llevar', title: 'Para Llevar' } },
      { type: 'reply', reply: { id: 'tipo_domicilio', title: 'Domicilio' } }
    ]
  );
}

return [{ json: { phone, waPayload, needsOrderCreation, orderData, updatedSession, originalCart: session.cart || [] } }];`;

const workflows = JSON.parse(fs.readFileSync('./n8n/workflows/workflow-export.json', 'utf8'));
const target = workflows.find(w => w.id === 'n3LfTGQWinpEEBez');
if (!target) { console.error('Workflow not found'); process.exit(1); }

const smNode = target.nodes.find(n => n.id === '48bc364f-5c85-49f2-8735-b7899b6d1705');
if (!smNode) { console.error('State Machine node not found'); process.exit(1); }

smNode.parameters.jsCode = newStateMachineCode;
console.log('State Machine node updated successfully');

fs.writeFileSync('./n8n/workflows/workflow-updated.json', JSON.stringify(workflows, null, 2));
console.log('Written to workflow-updated.json');
