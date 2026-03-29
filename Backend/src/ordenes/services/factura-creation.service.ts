import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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

	async crearFactura(clienteNombre: string, metodo?: string, descripcion?: string, manager?: EntityManager): Promise<FacturasVentas> {
		const repo = manager ? manager.getRepository(FacturasVentas) : this.facturasRepo;
		return repo.save(
			repo.create({
				clienteNombre,
				metodo: metodo ?? undefined,
				descripcion: descripcion || undefined,
			}),
		);
	}

	async findByIdempotencyKey(key: string): Promise<FacturasVentas | null> {
		return this.facturasRepo.findOne({ where: { idempotencyKey: key } });
	}

    async updateFactura(facturaId: number, updates: {
		total?: number; 
		descripcion?: string; 
		metodo?: string; 
		estado?: string;
		usuarioCobroId?: string;
		fechaCobro?: Date;
		ipDispositivo?: string;
		idempotencyKey?: string;
	}, manager?: EntityManager) {
		const repo = manager ? manager.getRepository(FacturasVentas) : this.facturasRepo;
        return repo.update(facturaId, updates);
    }

    async updateFacturaTotal(facturaId: number, total: number, manager?: EntityManager) {
		const repo = manager ? manager.getRepository(FacturasVentas) : this.facturasRepo;
        return repo.update(facturaId, {total});
    }

    async cancelarFactura(facturaId: number, manager?: EntityManager) {
		const repo = manager ? manager.getRepository(FacturasVentas) : this.facturasRepo;
        return repo.update(facturaId, {estado: 'cancelado'});
    }
}
