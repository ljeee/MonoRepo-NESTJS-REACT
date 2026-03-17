import {Entity, PrimaryGeneratedColumn, Column, OneToMany, Index} from 'typeorm';
import {ColumnNumericTransformer} from '../../common/utils/numeric.transformer';
import {Ordenes} from '../../ordenes/esquemas/ordenes.entity';
import {Domicilios} from '../../domicilios/esquemas/domicilios.entity';

@Entity('facturas_ventas')
@Index(['estado', 'fechaFactura'])
export class FacturasVentas {
	@PrimaryGeneratedColumn({name: 'factura_id'})
	facturaId: number;

	@Column({name: 'cliente_nombre', type: 'text', nullable: true})
	clienteNombre: string;

	@Column({name: 'descripcion', type: 'text', nullable: true})
	descripcion: string;

	@Column({type: 'timestamptz', default: () => 'now()'})
	@Index()
	fechaFactura: Date;

	@Column({name: 'estado', type: 'text', default: 'pendiente', nullable: true})
	estado: string;

	@Column({name: 'metodo', type: 'text', nullable: true})
	metodo: string;

	@Column({name: 'total', type: 'numeric', nullable: true, transformer: new ColumnNumericTransformer()})
	total: number;

	@Column({name: 'usuario_cobro_id', type: 'text', nullable: true})
	usuarioCobroId: string;

	@Column({name: 'fecha_cobro', type: 'timestamptz', nullable: true})
	fechaCobro: Date;

	@Column({name: 'ip_dispositivo', type: 'text', nullable: true})
	ipDispositivo: string;

	@Column({name: 'idempotency_key', type: 'text', nullable: true, unique: true})
	@Index({unique: true})
	idempotencyKey: string;

	@OneToMany(() => Ordenes, (orden) => orden.factura)
	ordenes: Ordenes[];

	@OneToMany(() => Domicilios, (domicilio) => domicilio.factura)
	domicilios: Domicilios[];
}
