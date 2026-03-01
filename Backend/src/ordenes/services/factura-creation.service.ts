import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FacturasVentas } from '../../facturas-ventas/esquemas/facturas-ventas.entity';
import { CreateOrdenItemDto } from '../esquemas/ordenes.dto';

@Injectable()
export class FacturaCreationService {
	constructor(
		@InjectRepository(FacturasVentas) private readonly facturasRepo: Repository<FacturasVentas>,
	) {}

	generarDescripcionFactura(productos: CreateOrdenItemDto[], construirNombreProducto: (item: CreateOrdenItemDto) => string): string {
		return productos.map((p) => `${p.cantidad ?? 1} ${construirNombreProducto(p)}`).join(', ');
	}

	async crearFactura(clienteNombre: string, metodo?: string, descripcion?: string): Promise<FacturasVentas> {
		return this.facturasRepo.save(
			this.facturasRepo.create({
				clienteNombre,
				metodo: metodo ?? undefined,
				descripcion: descripcion || undefined,
			}),
		);
	}

    async updateFacturaTotal(facturaId: number, total: number) {
        return this.facturasRepo.update(facturaId, {total});
    }

    async cancelarFactura(facturaId: number) {
        return this.facturasRepo.update(facturaId, {estado: 'cancelado'});
    }
}
