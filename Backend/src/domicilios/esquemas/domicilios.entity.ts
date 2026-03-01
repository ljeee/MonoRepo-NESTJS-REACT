import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index} from 'typeorm';
import {ColumnNumericTransformer} from '../../common/utils/numeric.transformer';
import {FacturasVentas} from '../../facturas-ventas/esquemas/facturas-ventas.entity';
import {Ordenes} from '../../ordenes/esquemas/ordenes.entity';
import {Clientes} from '../../clientes/esquemas/clientes.entity';
import {Domiciliarios} from '../../domiciliarios/esquemas/domiciliarios.entity';

@Entity('domicilios')
@Index(['estadoDomicilio', 'fechaCreado'])
export class Domicilios {
	@PrimaryGeneratedColumn({name: 'domicilio_id'})
	domicilioId: number;

	@Column({name: 'fecha_creado', type: 'timestamptz', nullable: true})
	@Index()
	fechaCreado: Date;

	@Column({name: 'factura_id', type: 'integer', nullable: true})
	facturaId: number;

	@Column({name: 'orden_id', type: 'integer', nullable: true})
	ordenId: number;

	@Column({name: 'telefono', type: 'text', nullable: true})
	telefono: string;

	@Column({name: 'telefono_domiciliario_asignado', type: 'text', nullable: true})
	telefonoDomiciliarioAsignado: string;

	@Column({name: 'direccion_entrega', type: 'text', nullable: true})
	direccionEntrega: string;

	@Column({name: 'costo_domicilio', type: 'numeric', nullable: true, default: 0, transformer: new ColumnNumericTransformer()})
	costoDomicilio: number;

	@Column({name: 'estado_domicilio', type: 'text', default: () => "'pendiente'"})
	estadoDomicilio: string;

	@ManyToOne(() => FacturasVentas, (factura) => factura.domicilios)
	@JoinColumn({name: 'factura_id'})
	factura: FacturasVentas;

	@ManyToOne(() => Ordenes, (orden) => orden.domicilios)
	@JoinColumn({name: 'orden_id'})
	orden: Ordenes;

	@ManyToOne(() => Clientes, (cliente) => cliente.domicilios)
	cliente: Clientes;

	@ManyToOne(() => Domiciliarios, (domiciliario) => domiciliario.domicilios)
	domiciliario: Domiciliarios;
}
