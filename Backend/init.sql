--
-- PostgreSQL database dump
--

\restrict gle6ATagQQqoIoIeWyAL7f71FBlitINnm9l1ga1mIacVBrUbkvmGhZA5gSWP4tu

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: caja_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caja_movimientos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    fecha date NOT NULL,
    tipo character varying(20) NOT NULL,
    denominaciones jsonb NOT NULL,
    total numeric NOT NULL,
    factura_venta_id bigint,
    factura_pago_id bigint,
    descripcion text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    metodo text,
    pago_transferencia numeric,
    caja_origen character varying(20) DEFAULT 'principal'::character varying NOT NULL
);


--
-- Name: cierres_caja; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cierres_caja (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    fecha date NOT NULL,
    "totalVentas" numeric NOT NULL,
    "totalEgresos" numeric NOT NULL,
    "balanceNeto" numeric NOT NULL,
    "totalOrdenes" integer NOT NULL,
    "totalFacturas" integer NOT NULL,
    "ticketPromedio" numeric NOT NULL,
    "metodosPago" jsonb,
    "productosTop" jsonb,
    observaciones text,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: cliente_direcciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_direcciones (
    id integer NOT NULL,
    telefono_cliente text NOT NULL,
    direccion text NOT NULL
);


--
-- Name: cliente_direcciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_direcciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cliente_direcciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_direcciones_id_seq OWNED BY public.cliente_direcciones.id;


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    telefono text NOT NULL,
    cliente_nombre text,
    tipo_documento text,
    documento text,
    correo text
);


--
-- Name: domiciliarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domiciliarios (
    telefono text NOT NULL,
    domiciliario_nombre text,
    user_id uuid
);


--
-- Name: domicilios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domicilios (
    domicilio_id integer NOT NULL,
    fecha_creado timestamp with time zone,
    factura_id integer,
    orden_id integer,
    telefono text,
    telefono_domiciliario_asignado text,
    direccion_entrega text,
    costo_domicilio numeric DEFAULT 0,
    estado_domicilio text DEFAULT 'pendiente'::text NOT NULL,
    assigned_user_id uuid,
    "clienteTelefono" text,
    "domiciliarioTelefono" text
);


--
-- Name: domicilios_domicilio_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.domicilios ALTER COLUMN domicilio_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.domicilios_domicilio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: empresa_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresa_config (
    id integer NOT NULL,
    nit text NOT NULL,
    razon_social text NOT NULL,
    nombre_comercial text,
    regimen text DEFAULT 'Régimen Simple'::text NOT NULL,
    direccion text,
    telefono text,
    municipio text,
    departamento text,
    tarifa_iva numeric DEFAULT '0'::numeric NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: empresa_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empresa_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresa_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empresa_config_id_seq OWNED BY public.empresa_config.id;


--
-- Name: facturas_pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facturas_pagos (
    pagos_id bigint NOT NULL,
    total numeric,
    nombre_gasto text,
    descripcion text,
    estado text,
    fecha_factura date,
    metodo text,
    categoria text DEFAULT 'general'::text,
    denominaciones jsonb
);


--
-- Name: facturas_pagos_pagos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.facturas_pagos ALTER COLUMN pagos_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.facturas_pagos_pagos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: facturas_ventas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facturas_ventas (
    factura_id integer NOT NULL,
    cliente_nombre text,
    descripcion text,
    estado text DEFAULT 'pendiente'::text,
    metodo text,
    total numeric,
    "fechaFactura" timestamp with time zone DEFAULT now() NOT NULL,
    pago_efectivo numeric,
    pago_transferencia numeric,
    usuario_cobro_id text,
    fecha_cobro timestamp with time zone,
    ip_dispositivo text,
    idempotency_key text,
    denominaciones jsonb,
    cambio_denominaciones jsonb,
    telefono_cliente text
);


--
-- Name: facturas_ventas_factura_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.facturas_ventas ALTER COLUMN factura_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.facturas_ventas_factura_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ingredientes_bebidas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredientes_bebidas (
    id integer NOT NULL,
    nombre text NOT NULL,
    categoria text DEFAULT 'otro'::text NOT NULL,
    unidad text DEFAULT 'unidad'::text NOT NULL,
    "stockActual" numeric DEFAULT '0'::numeric NOT NULL,
    "rendimientoPorUnidad" numeric DEFAULT '1'::numeric NOT NULL,
    "alertaMinimo" numeric,
    costo numeric,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ingredientes_bebidas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingredientes_bebidas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingredientes_bebidas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingredientes_bebidas_id_seq OWNED BY public.ingredientes_bebidas.id;


--
-- Name: inventario_cajas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventario_cajas (
    id integer NOT NULL,
    nombre character varying(150) DEFAULT ''::character varying NOT NULL,
    cantidad integer DEFAULT 0 NOT NULL,
    "alertaMinimo" integer,
    "actualizadoEn" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventario_cajas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventario_cajas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventario_cajas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventario_cajas_id_seq OWNED BY public.inventario_cajas.id;


--
-- Name: inventario_cajas_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventario_cajas_movimientos (
    id integer NOT NULL,
    "cajaId" integer NOT NULL,
    delta integer NOT NULL,
    "cantidadResultante" integer NOT NULL,
    tipo character varying(50) DEFAULT 'ajuste'::character varying NOT NULL,
    nota character varying(255),
    "creadoEn" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventario_cajas_movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventario_cajas_movimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventario_cajas_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventario_cajas_movimientos_id_seq OWNED BY public.inventario_cajas_movimientos.id;


--
-- Name: ordenes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes (
    orden_id integer NOT NULL,
    factura_id integer,
    tipo_pedido text DEFAULT 'mesa'::text NOT NULL,
    estado_orden text DEFAULT 'pendiente'::text NOT NULL,
    fecha_orden timestamp with time zone DEFAULT now() NOT NULL,
    observaciones text,
    usuario_cancelacion_id text,
    fecha_cancelacion timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ordenes_orden_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ordenes ALTER COLUMN orden_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.ordenes_orden_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ordenes_productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes_productos (
    id bigint NOT NULL,
    orden_id integer,
    producto text,
    cantidad numeric,
    precio_unitario numeric,
    variante_id integer,
    base text,
    "productoObjProductoId" integer
);


--
-- Name: ordenes_productos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ordenes_productos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ordenes_productos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pizza_sabores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_sabores (
    sabor_id integer NOT NULL,
    nombre text NOT NULL,
    tipo text DEFAULT 'tradicional'::text NOT NULL,
    recargo_pequena numeric DEFAULT 0 NOT NULL,
    recargo_mediana numeric DEFAULT 0 NOT NULL,
    recargo_grande numeric DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: pizza_sabores_sabor_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.pizza_sabores ALTER COLUMN sabor_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.pizza_sabores_sabor_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: producto_variantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producto_variantes (
    variante_id integer NOT NULL,
    producto_id integer NOT NULL,
    nombre text NOT NULL,
    precio numeric NOT NULL,
    descripcion text,
    activo boolean DEFAULT true NOT NULL,
    precio_leche numeric,
    stock_bebida integer DEFAULT 0 NOT NULL
);


--
-- Name: producto_variantes_variante_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.producto_variantes ALTER COLUMN variante_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.producto_variantes_variante_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    producto_id integer NOT NULL,
    producto_nombre text NOT NULL,
    descripcion text,
    activo boolean DEFAULT true NOT NULL,
    emoji text
);


--
-- Name: productos_producto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.productos ALTER COLUMN producto_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.productos_producto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    roles text[] DEFAULT '{}'::text[] NOT NULL,
    "passwordHash" character varying NOT NULL,
    "refreshTokenHash" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    username character varying NOT NULL,
    name character varying
);


--
-- Name: variantes_ingredientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variantes_ingredientes (
    id integer NOT NULL,
    variante_id integer NOT NULL,
    ingrediente_id integer NOT NULL,
    "cantidadPorVenta" numeric DEFAULT '1'::numeric NOT NULL
);


--
-- Name: variantes_ingredientes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.variantes_ingredientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: variantes_ingredientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.variantes_ingredientes_id_seq OWNED BY public.variantes_ingredientes.id;


--
-- Name: cliente_direcciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_direcciones ALTER COLUMN id SET DEFAULT nextval('public.cliente_direcciones_id_seq'::regclass);


--
-- Name: empresa_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_config ALTER COLUMN id SET DEFAULT nextval('public.empresa_config_id_seq'::regclass);


--
-- Name: ingredientes_bebidas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredientes_bebidas ALTER COLUMN id SET DEFAULT nextval('public.ingredientes_bebidas_id_seq'::regclass);


--
-- Name: inventario_cajas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventario_cajas ALTER COLUMN id SET DEFAULT nextval('public.inventario_cajas_id_seq'::regclass);


--
-- Name: inventario_cajas_movimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventario_cajas_movimientos ALTER COLUMN id SET DEFAULT nextval('public.inventario_cajas_movimientos_id_seq'::regclass);


--
-- Name: variantes_ingredientes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantes_ingredientes ALTER COLUMN id SET DEFAULT nextval('public.variantes_ingredientes_id_seq'::regclass);


--
-- Name: caja_movimientos PK_293175481d7a75ce5733c256201; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caja_movimientos
    ADD CONSTRAINT "PK_293175481d7a75ce5733c256201" PRIMARY KEY (id);


--
-- Name: cliente_direcciones PK_410a4913439416feed17a0462b9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_direcciones
    ADD CONSTRAINT "PK_410a4913439416feed17a0462b9" PRIMARY KEY (id);


--
-- Name: inventario_cajas PK_6772e1fec2aebe1c4490b13d078; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventario_cajas
    ADD CONSTRAINT "PK_6772e1fec2aebe1c4490b13d078" PRIMARY KEY (id);


--
-- Name: cierres_caja PK_745ea63bc26660d2a5b1b81eac0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierres_caja
    ADD CONSTRAINT "PK_745ea63bc26660d2a5b1b81eac0" PRIMARY KEY (id);


--
-- Name: variantes_ingredientes PK_9f4b8fe56eb7567fd9fb20c0084; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantes_ingredientes
    ADD CONSTRAINT "PK_9f4b8fe56eb7567fd9fb20c0084" PRIMARY KEY (id);


--
-- Name: inventario_cajas_movimientos PK_dd90a0a9621c27e65ca7c527fce; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventario_cajas_movimientos
    ADD CONSTRAINT "PK_dd90a0a9621c27e65ca7c527fce" PRIMARY KEY (id);


--
-- Name: ingredientes_bebidas PK_e32d2d797b856ae9dd9d088ac1c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredientes_bebidas
    ADD CONSTRAINT "PK_e32d2d797b856ae9dd9d088ac1c" PRIMARY KEY (id);


--
-- Name: empresa_config PK_ffc96ee0ababfefc26c16c0653f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresa_config
    ADD CONSTRAINT "PK_ffc96ee0ababfefc26c16c0653f" PRIMARY KEY (id);


--
-- Name: facturas_ventas UQ_563d74c586a31ad9c3905af2ec4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas_ventas
    ADD CONSTRAINT "UQ_563d74c586a31ad9c3905af2ec4" UNIQUE (idempotency_key);


--
-- Name: domiciliarios UQ_fafe18eefb33500e1fa800f2d58; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domiciliarios
    ADD CONSTRAINT "UQ_fafe18eefb33500e1fa800f2d58" UNIQUE (user_id);


--
-- Name: users UQ_fe0bb3f6520ee0469504521e710; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE (username);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (telefono);


--
-- Name: domiciliarios domiciliarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domiciliarios
    ADD CONSTRAINT domiciliarios_pkey PRIMARY KEY (telefono);


--
-- Name: domicilios domicilios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domicilios
    ADD CONSTRAINT domicilios_pkey PRIMARY KEY (domicilio_id);


--
-- Name: facturas_pagos facturas_pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas_pagos
    ADD CONSTRAINT facturas_pagos_pkey PRIMARY KEY (pagos_id);


--
-- Name: facturas_ventas facturas_ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas_ventas
    ADD CONSTRAINT facturas_ventas_pkey PRIMARY KEY (factura_id);


--
-- Name: ordenes ordenes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes
    ADD CONSTRAINT ordenes_pkey PRIMARY KEY (orden_id);


--
-- Name: ordenes_productos ordenes_productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_productos
    ADD CONSTRAINT ordenes_productos_pkey PRIMARY KEY (id);


--
-- Name: pizza_sabores pizza_sabores_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_sabores
    ADD CONSTRAINT pizza_sabores_nombre_key UNIQUE (nombre);


--
-- Name: pizza_sabores pizza_sabores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_sabores
    ADD CONSTRAINT pizza_sabores_pkey PRIMARY KEY (sabor_id);


--
-- Name: producto_variantes producto_variantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_variantes
    ADD CONSTRAINT producto_variantes_pkey PRIMARY KEY (variante_id);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (producto_id);


--
-- Name: productos productos_producto_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_producto_nombre_key UNIQUE (producto_nombre);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_03a90cfeeaffe4d3602cb4871d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_03a90cfeeaffe4d3602cb4871d" ON public.domicilios USING btree (estado_domicilio, fecha_creado);


--
-- Name: IDX_04c1327bc33eca5008add94478; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_04c1327bc33eca5008add94478" ON public.ordenes USING btree (estado_orden, fecha_orden);


--
-- Name: IDX_0dbdf4edacd6dbf24129b9a667; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0dbdf4edacd6dbf24129b9a667" ON public.domicilios USING btree (fecha_creado);


--
-- Name: IDX_0fcbb9f42ca1ed46f5067534c5; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_0fcbb9f42ca1ed46f5067534c5" ON public.cierres_caja USING btree (fecha);


--
-- Name: IDX_3213a4257de8efcd9ce1b8c3b7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3213a4257de8efcd9ce1b8c3b7" ON public.productos USING btree (producto_nombre);


--
-- Name: IDX_563d74c586a31ad9c3905af2ec; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_563d74c586a31ad9c3905af2ec" ON public.facturas_ventas USING btree (idempotency_key);


--
-- Name: IDX_5d45504a17f7a376badf12baa0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5d45504a17f7a376badf12baa0" ON public.facturas_ventas USING btree (estado, "fechaFactura");


--
-- Name: IDX_6ee340f6d91522adc50a9657a5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6ee340f6d91522adc50a9657a5" ON public.facturas_ventas USING btree ("fechaFactura");


--
-- Name: IDX_717ab419ad8eec7c2c83af5735; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_717ab419ad8eec7c2c83af5735" ON public.pizza_sabores USING btree (nombre);


--
-- Name: IDX_8b9f18fd25b2b11f9c50205fed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8b9f18fd25b2b11f9c50205fed" ON public.facturas_pagos USING btree (fecha_factura);


--
-- Name: IDX_a20551693e88c96e363b337222; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a20551693e88c96e363b337222" ON public.producto_variantes USING btree (nombre);


--
-- Name: IDX_b646dc3edf410d79329210b3b3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b646dc3edf410d79329210b3b3" ON public.caja_movimientos USING btree (caja_origen);


--
-- Name: IDX_d892098cbfcd0bc150998975b9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d892098cbfcd0bc150998975b9" ON public.caja_movimientos USING btree (fecha);


--
-- Name: IDX_f0d5042fc6f0f2a60dbc3d5a8a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f0d5042fc6f0f2a60dbc3d5a8a" ON public.ordenes USING btree (fecha_orden);


--
-- Name: domicilios FK_1b281863693925f1e2f27de1747; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domicilios
    ADD CONSTRAINT "FK_1b281863693925f1e2f27de1747" FOREIGN KEY ("domiciliarioTelefono") REFERENCES public.domiciliarios(telefono);


--
-- Name: cliente_direcciones FK_31e37324ce2834535b76463fba9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_direcciones
    ADD CONSTRAINT "FK_31e37324ce2834535b76463fba9" FOREIGN KEY (telefono_cliente) REFERENCES public.clientes(telefono) ON DELETE CASCADE;


--
-- Name: domicilios FK_6f4660a6c78418e53e69b8429c2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domicilios
    ADD CONSTRAINT "FK_6f4660a6c78418e53e69b8429c2" FOREIGN KEY (orden_id) REFERENCES public.ordenes(orden_id) ON DELETE CASCADE;


--
-- Name: inventario_cajas_movimientos FK_707d92ac097d3f13be32a9c411b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventario_cajas_movimientos
    ADD CONSTRAINT "FK_707d92ac097d3f13be32a9c411b" FOREIGN KEY ("cajaId") REFERENCES public.inventario_cajas(id) ON DELETE CASCADE;


--
-- Name: domicilios FK_7288fc1d426fa61e1925d4086f3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domicilios
    ADD CONSTRAINT "FK_7288fc1d426fa61e1925d4086f3" FOREIGN KEY (factura_id) REFERENCES public.facturas_ventas(factura_id) ON DELETE CASCADE;


--
-- Name: variantes_ingredientes FK_7a93c29f32bc0d9023689319364; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variantes_ingredientes
    ADD CONSTRAINT "FK_7a93c29f32bc0d9023689319364" FOREIGN KEY (ingrediente_id) REFERENCES public.ingredientes_bebidas(id) ON DELETE CASCADE;


--
-- Name: ordenes_productos FK_7ab0e168a47f998cac9ce3697b1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_productos
    ADD CONSTRAINT "FK_7ab0e168a47f998cac9ce3697b1" FOREIGN KEY (orden_id) REFERENCES public.ordenes(orden_id) ON DELETE CASCADE;


--
-- Name: producto_variantes FK_8a42b60a1b9e3bf8ea297562c9c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_variantes
    ADD CONSTRAINT "FK_8a42b60a1b9e3bf8ea297562c9c" FOREIGN KEY (producto_id) REFERENCES public.productos(producto_id) ON DELETE CASCADE;


--
-- Name: ordenes FK_8b935068c0bad190b62d476949f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes
    ADD CONSTRAINT "FK_8b935068c0bad190b62d476949f" FOREIGN KEY (factura_id) REFERENCES public.facturas_ventas(factura_id) ON DELETE CASCADE;


--
-- Name: ordenes_productos FK_ecf403d2351f7f1ba272cb672a0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_productos
    ADD CONSTRAINT "FK_ecf403d2351f7f1ba272cb672a0" FOREIGN KEY ("productoObjProductoId") REFERENCES public.productos(producto_id);


--
-- Name: ordenes_productos FK_f50debb83c28a3095f511bed0a0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_productos
    ADD CONSTRAINT "FK_f50debb83c28a3095f511bed0a0" FOREIGN KEY (variante_id) REFERENCES public.producto_variantes(variante_id);


--
-- Name: domicilios FK_f764988424fdb8a1fd23b95b4a6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domicilios
    ADD CONSTRAINT "FK_f764988424fdb8a1fd23b95b4a6" FOREIGN KEY ("clienteTelefono") REFERENCES public.clientes(telefono);


--
-- Name: domiciliarios FK_fafe18eefb33500e1fa800f2d58; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domiciliarios
    ADD CONSTRAINT "FK_fafe18eefb33500e1fa800f2d58" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict gle6ATagQQqoIoIeWyAL7f71FBlitINnm9l1ga1mIacVBrUbkvmGhZA5gSWP4tu

