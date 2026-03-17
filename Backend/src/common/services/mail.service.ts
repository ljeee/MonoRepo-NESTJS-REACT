import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private transporter: nodemailer.Transporter;

    constructor(private readonly config: ConfigService) {
        const mailSecure = this.config.get('MAIL_SECURE');
        // Robust boolean parsing for environment variables
        const isSecure = mailSecure === true || mailSecure === 'true';

        this.transporter = nodemailer.createTransport({
            host: this.config.get('MAIL_HOST'),
            port: Number(this.config.get('MAIL_PORT', 587)),
            secure: isSecure,
            auth: {
                user: this.config.get('MAIL_USER'),
                pass: this.config.get('MAIL_PASS'),
            },
        });
    }

    async sendCierreReport(to: string, data: any) {
        const companyName = data.empresa?.nombreComercial || data.empresa?.razonSocial || this.config.get('COMPANY_NAME', 'Antigravity POS');
        const nit = data.empresa?.nit || this.config.get('COMPANY_NIT', 'N/A');
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0F172A; color: #F8FAFC; margin: 0; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #1E293B; border-radius: 20px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
                    .header { background-color: #F5A524; padding: 40px 20px; text-align: center; }
                    .header h1 { margin: 0; color: #0F172A; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; }
                    .header p { margin: 5px 0 0; color: #0F172A; opacity: 0.8; font-weight: 600; font-size: 12px; }
                    .content { padding: 40px 20px; }
                    @media (max-width: 480px) { .content { padding: 20px 15px; } }
                    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 40px; }
                    .stat-card { background-color: rgba(255,255,255,0.03); padding: 15px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); }
                    .stat-label { font-size: 10px; font-weight: 800; color: #CBD5E1; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
                    .stat-value { font-size: 18px; font-weight: 900; color: #F1F5F9; }
                    .stat-value.success { color: #10B981; }
                    .stat-value.warning { color: #F5A524; }
                    .divider { height: 1px; background: linear-gradient(to right, transparent, #334155, transparent); margin: 30px 0; }
                    .table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                    .table th { text-align: left; font-size: 10px; color: #CBD5E1; text-transform: uppercase; padding: 10px 5px; border-bottom: 1px solid #475569; }
                    .table td { padding: 12px 5px; font-size: 12px; color: #FFFFFF; border-bottom: 1px solid rgba(255,255,255,0.03); word-break: break-word; }
                    .table .small-text { font-size: 11px; }
                    .footer { padding: 30px; text-align: center; background-color: rgba(0,0,0,0.2); }
                    .footer p { margin: 0; font-size: 10px; color: #94A3B8; font-weight: bold; letter-spacing: 1px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Cierre de Jornada</h1>
                        <p>${companyName} | NIT: ${nit}</p>
                    </div>
                    
                    <div class="content">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <span style="background: rgba(245, 165, 36, 0.1); color: #F5A524; padding: 5px 15px; border-radius: 20px; font-size: 11px; font-weight: 900;">
                                FECHA: ${data.fecha}
                            </span>
                        </div>
 
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-label">Ingresos Totales</div>
                                <div class="stat-value success">$${data.totalVentas.toLocaleString()}</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">Egresos/Gastos</div>
                                <div class="stat-value" style="color: #EF4444;">$${data.totalEgresos.toLocaleString()}</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">Balance Neto</div>
                                <div class="stat-value warning">$${data.balanceNeto.toLocaleString()}</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">Órdenes</div>
                                <div class="stat-value">${data.totalOrdenes}</div>
                            </div>
                        </div>
 
                        <div class="divider"></div>
 
                        <h3 style="font-size: 13px; font-weight: 900; margin-bottom: 20px; color: #CBD5E1; text-align: center; letter-spacing: 1px;">DETALLE POR MÉTODO</h3>
                        <table class="table" style="margin-bottom: 40px;">
                            <thead>
                                <tr>
                                    <th style="width: 60%;">Método</th>
                                    <th style="text-align: right; width: 40%;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.metodosPago?.map(m => `
                                    <tr>
                                        <td style="font-weight: 700;">${m.metodo.toUpperCase()}</td>
                                        <td style="text-align: right; font-weight: 900; color: #F5A524;">$${m.total.toLocaleString()}</td>
                                    </tr>
                                `).join('') || '<tr><td colspan="2" style="text-align:center; opacity:0.5;">No hay datos de métodos</td></tr>'}
                            </tbody>
                        </table>
 
                        <div class="divider"></div>
 
                        <h3 style="font-size: 13px; font-weight: 900; margin-bottom: 20px; color: #CBD5E1; text-align: center; letter-spacing: 1px;">DETALLE DE TRANSACCIONES</h3>
                        <table class="table">
                            <thead>
                                <tr>
                                    <th style="width: 25%;">ID</th>
                                    <th style="width: 45%;">Medio Pago</th>
                                    <th style="text-align: right; width: 30%;">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.facturas?.map(f => `
                                    <tr class="small-text">
                                        <td>${f.facturaId}</td>
                                        <td>${f.metodo.toUpperCase()}</td>
                                        <td style="text-align: right; font-weight: 700; color: #F1F5F9;">$${f.total.toLocaleString()}</td>
                                    </tr>
                                `).join('') || '<tr><td colspan="3" style="text-align:center; opacity:0.5;">No hay transacciones registradas</td></tr>'}
                            </tbody>
                        </table>
                    </div>

                    <div class="footer">
                        <p>Dfiruexpo POS — Sistema de Gestión Inteligente</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Support multiple recipients if 'to' is a comma-separated string
        const recipients = typeof to === 'string' 
            ? to.split(',').map(email => email.trim()).filter(email => !!email)
            : to;

        await this.transporter.sendMail({
            from: `"${companyName}" <${this.config.get('MAIL_USER')}>`,
            to: recipients,
            subject: `Cierre de Caja - ${data.fecha} - ${companyName}`,
            html,
        });
    }
}
