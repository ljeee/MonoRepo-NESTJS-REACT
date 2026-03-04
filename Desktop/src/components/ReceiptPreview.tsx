import * as Dialog from '@radix-ui/react-dialog';
import { Printer, X, Eye, Phone as PhoneIcon, MapPin } from 'lucide-react';
import { formatCurrency } from '../utils/formatNumber';
import type { ReceiptProduct } from '../utils/printReceipt';

export interface ReceiptData {
    ordenId?: number;
    clienteNombre: string;
    telefonoCliente?: string;
    metodo: string;
    productos: ReceiptProduct[];
    total: number;
    costoDomicilio?: number;
    direccion?: string;
    fecha?: string;
    tipoPedido?: string;
}

/** Configurable business info */
export interface BusinessInfo {
    nombre: string;
    telefono?: string;
    direccion?: string;
    nit?: string;
    footer?: string;
}

const DEFAULT_BUSINESS: BusinessInfo = {
    nombre: 'PIZZERIA',
    telefono: '',
    direccion: '',
    footer: '¡Gracias por su compra!',
};

function buildReceiptHtml(data: ReceiptData, biz: BusinessInfo, autoPrint: boolean): string {
    const fecha = data.fecha
        ? new Date(data.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
        : new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

    const productRows = data.productos
        .map(
            (p) =>
                `<tr><td>${p.cantidad}x ${p.nombre}</td><td class="r">$${formatCurrency(p.precioUnitario * p.cantidad)}</td></tr>`,
        )
        .join('');

    const subtotal = data.productos.reduce((s, p) => s + p.precioUnitario * p.cantidad, 0);

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo #${data.ordenId || ''}</title>
<style>
@page{margin:0;size:auto}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New','Lucida Console',monospace;font-size:16px;width:100%;max-width:400px;margin:0 auto;padding:20px;color:#000;line-height:1.4}
.c{text-align:center}
.b{font-weight:bold}
.r{text-align:right}
.d{border-top:2px dashed #000;margin:10px 0}
.dd{border-top:2px solid #000;margin:10px 0}
h1{font-size:24px;margin-bottom:4px;letter-spacing:2px}
.biz-info{font-size:14px;color:#333}
table{width:100%;border-collapse:collapse}
td{padding:4px 0;vertical-align:top}
.total-row td{font-size:20px;font-weight:bold;padding-top:10px}
.footer{margin-top:16px;font-size:14px}
.badge{display:inline-block;padding:2px 8px;border:1px solid #000;border-radius:3px;font-size:12px;font-weight:bold;text-transform:uppercase;margin-top:6px}
</style></head><body>
<div class="c">
  <h1>${biz.nombre}</h1>
  ${biz.direccion ? `<p class="biz-info">${biz.direccion}</p>` : ''}
  ${biz.telefono ? `<p class="biz-info">Tel: ${biz.telefono}</p>` : ''}
  ${biz.nit ? `<p class="biz-info">NIT: ${biz.nit}</p>` : ''}
</div>
<div class="dd"></div>
<table>
  ${data.ordenId ? `<tr><td class="b">Orden:</td><td class="r">#${data.ordenId}</td></tr>` : ''}
  <tr><td class="b">Fecha:</td><td class="r">${fecha}</td></tr>
  <tr><td class="b">Cliente:</td><td class="r">${data.clienteNombre || 'N/A'}</td></tr>
  ${data.telefonoCliente ? `<tr><td class="b">Tel:</td><td class="r">${data.telefonoCliente}</td></tr>` : ''}
  ${data.tipoPedido ? `<tr><td class="b">Tipo:</td><td class="r"><span class="badge">${data.tipoPedido}</span></td></tr>` : ''}
  ${data.direccion ? `<tr><td class="b">Dir:</td><td class="r" style="font-size:11px">${data.direccion}</td></tr>` : ''}
  <tr><td class="b">Pago:</td><td class="r">${data.metodo || 'N/A'}</td></tr>
</table>
<div class="d"></div>
<table><tbody>${productRows}</tbody></table>
<div class="d"></div>
<table>
  <tr><td>Subtotal</td><td class="r">$${formatCurrency(subtotal)}</td></tr>
  ${data.costoDomicilio ? `<tr><td>Domicilio</td><td class="r">$${formatCurrency(data.costoDomicilio)}</td></tr>` : ''}
</table>
<div class="dd"></div>
<table><tr class="total-row"><td>TOTAL</td><td class="r">$${formatCurrency(data.total)}</td></tr></table>
<div class="dd"></div>
<div class="c footer">
  <p>${biz.footer || '¡Gracias por su compra!'}</p>
  <p style="margin-top:4px;font-size:9px">*** ${fecha} ***</p>
</div>
${autoPrint ? '<script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)};</script>' : ''}
</body></html>`;
}

export function printReceiptDirect(data: ReceiptData, biz?: BusinessInfo) {
    const html = buildReceiptHtml(data, biz || DEFAULT_BUSINESS, true);
    const w = window.open('', '_blank', 'width=320,height=600');
    if (w) {
        w.document.write(html);
        w.document.close();
    }
}

interface ReceiptPreviewModalProps {
    open: boolean;
    onClose: () => void;
    data: ReceiptData | null;
    businessInfo?: BusinessInfo;
}

export function ReceiptPreviewModal({ open, onClose, data, businessInfo }: ReceiptPreviewModalProps) {
    const biz = businessInfo || DEFAULT_BUSINESS;

    if (!data) return null;

    const handlePrint = () => {
        printReceiptDirect(data, biz);
    };

    const fecha = data.fecha
        ? new Date(data.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
        : new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

    const subtotal = data.productos.reduce((s, p) => s + p.precioUnitario * p.cantidad, 0);

    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="dialog-overlay" />
                <Dialog.Content className="dialog-content receipt-preview-dialog">
                    <div className="receipt-preview-header">
                        <Dialog.Title className="dialog-title">
                            <Eye size={18} />
                            Vista Previa de Recibo
                        </Dialog.Title>
                        <button type="button" className="btn-icon" onClick={onClose}>
                            <X size={18} />
                        </button>
                    </div>

                    {/* Receipt visual */}
                    <div className="receipt-paper">
                        <div className="receipt-biz-header">
                            <h2 className="receipt-biz-name">{biz.nombre}</h2>
                            {biz.direccion && (
                                <p className="receipt-biz-detail">
                                    <MapPin size={10} /> {biz.direccion}
                                </p>
                            )}
                            {biz.telefono && (
                                <p className="receipt-biz-detail">
                                    <PhoneIcon size={10} /> {biz.telefono}
                                </p>
                            )}
                            {biz.nit && <p className="receipt-biz-detail">NIT: {biz.nit}</p>}
                        </div>

                        <div className="receipt-divider double" />

                        <div className="receipt-info-grid">
                            {data.ordenId && (
                                <div className="receipt-info-row">
                                    <span>Orden</span><span>#{data.ordenId}</span>
                                </div>
                            )}
                            <div className="receipt-info-row">
                                <span>Fecha</span><span>{fecha}</span>
                            </div>
                            <div className="receipt-info-row">
                                <span>Cliente</span><span>{data.clienteNombre || 'N/A'}</span>
                            </div>
                            {data.tipoPedido && (
                                <div className="receipt-info-row">
                                    <span>Tipo</span>
                                    <span className="receipt-badge">{data.tipoPedido}</span>
                                </div>
                            )}
                            {data.direccion && (
                                <div className="receipt-info-row">
                                    <span>Dirección</span><span>{data.direccion}</span>
                                </div>
                            )}
                            <div className="receipt-info-row">
                                <span>Pago</span><span>{data.metodo || 'N/A'}</span>
                            </div>
                        </div>

                        <div className="receipt-divider" />

                        <div className="receipt-products">
                            {data.productos.map((p, i) => (
                                <div key={i} className="receipt-product-row">
                                    <span>{p.cantidad}x {p.nombre}</span>
                                    <span>${formatCurrency(p.precioUnitario * p.cantidad)}</span>
                                </div>
                            ))}
                        </div>

                        <div className="receipt-divider" />

                        <div className="receipt-totals">
                            <div className="receipt-subtotal-row">
                                <span>Subtotal</span>
                                <span>${formatCurrency(subtotal)}</span>
                            </div>
                            {data.costoDomicilio && data.costoDomicilio > 0 && (
                                <div className="receipt-subtotal-row">
                                    <span>Domicilio</span>
                                    <span>${formatCurrency(data.costoDomicilio)}</span>
                                </div>
                            )}
                        </div>

                        <div className="receipt-divider double" />

                        <div className="receipt-total-row">
                            <span>TOTAL</span>
                            <span>${formatCurrency(data.total)}</span>
                        </div>

                        <div className="receipt-divider double" />

                        <p className="receipt-footer">{biz.footer || '¡Gracias por su compra!'}</p>
                    </div>

                    {/* Actions */}
                    <div className="receipt-preview-actions">
                        <button type="button" className="btn-ghost" onClick={onClose}>
                            Cerrar
                        </button>
                        <button type="button" className="btn-primary" onClick={handlePrint}>
                            <Printer size={16} />
                            Imprimir Recibo
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
