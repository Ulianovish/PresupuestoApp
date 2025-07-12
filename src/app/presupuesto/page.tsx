/**
 * PresupuestoPage - Página de presupuesto mensual
 * Muestra una tabla expandible con categorías y sus detalles
 */
"use client";

import { useState } from "react";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/atoms/Card/Card";
import Button from "@/components/atoms/Button/Button";
import { ChevronDown, ChevronRight, Edit, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Tipos para los datos del presupuesto
interface PresupuestoItem {
  id: string;
  descripcion: string;
  fecha: string;
  clasificacion: "Fijo" | "Variable" | "Discrecional";
  control: "Necesario" | "Discrecional";
  presupuestado: number;
  real: number;
}

interface PresupuestoCategoria {
  id: string;
  nombre: string;
  totalPresupuestado: number;
  totalReal: number;
  items: PresupuestoItem[];
  expanded: boolean;
}

// Estado del modal para agregar/editar detalles
interface ModalState {
  isOpen: boolean;
  mode: 'add' | 'edit';
  categoriaId: string;
  item?: PresupuestoItem;
}

// Datos mockeados basados en las imágenes de referencia
const presupuestoMock: PresupuestoCategoria[] = [
  {
    id: "vivienda",
    nombre: "VIVIENDA",
    totalPresupuestado: 7904114,
    totalReal: 8009845,
    expanded: false,
    items: [
      {
        id: "cuota-apto",
        descripcion: "Cuota Apto",
        fecha: "5/mes",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 3100000,
        real: 4357000,
      },
      {
        id: "administracion",
        descripcion: "Administración",
        fecha: "29/mes",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 300000,
        real: 1624000,
      },
      {
        id: "epm",
        descripcion: "EPM",
        fecha: "24/mes",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 709065,
        real: 0,
      },
      {
        id: "martrix",
        descripcion: "Martrix",
        fecha: "30/mes",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 450000,
        real: 450000,
      },
      {
        id: "internet",
        descripcion: "Internet",
        fecha: "10/mes",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 76049,
        real: 93845,
      },
      {
        id: "arreglos",
        descripcion: "Arreglos",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 500000,
        real: 0,
      },
      {
        id: "remodelacion",
        descripcion: "Remodelación",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 1200000,
        real: 0,
      },
      {
        id: "muebles",
        descripcion: "Muebles",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 150000,
        real: 75000,
      },
      {
        id: "arriendo",
        descripcion: "Arriendo",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 1419000,
        real: 1410000,
      },
    ],
  },
  {
    id: "deudas",
    nombre: "DEUDAS",
    totalPresupuestado: 6337850,
    totalReal: 0,
    expanded: false,
    items: [
      {
        id: "tc-falabella",
        descripcion: "TC Falabella",
        fecha: "10/mes",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 2500000,
        real: 3200000,
      },
      {
        id: "tc-nubank",
        descripcion: "TC NuBank",
        fecha: "21/mes",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 2850000,
        real: 0,
      },
      {
        id: "sinfa",
        descripcion: "Sinfa",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "carro",
        descripcion: "Carro",
        fecha: "5/mes",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 987850,
        real: 987850,
      },
      {
        id: "gloria",
        descripcion: "Gloria",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 6700000,
      },
    ],
  },
  {
    id: "transporte",
    nombre: "TRANSPORTE",
    totalPresupuestado: 875000,
    totalReal: 0,
    expanded: false,
    items: [
      {
        id: "gasolina",
        descripcion: "Gasolina",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 8200,
      },
      {
        id: "parking",
        descripcion: "Parking",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "lavadero",
        descripcion: "Lavadero",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "comprepartos",
        descripcion: "Comprepartos",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "mantenimientos",
        descripcion: "Mantenimientos",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "civica",
        descripcion: "Cívica",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 440000,
        real: 0,
      },
      {
        id: "licencia-conduccion",
        descripcion: "Licencia de conducción",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 435000,
        real: 0,
      },
      {
        id: "didi",
        descripcion: "Didi",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 711710,
      },
      {
        id: "metro",
        descripcion: "Metro",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "vuelos",
        descripcion: "Vuelos",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
    ],
  },
  {
    id: "impuestos",
    nombre: "IMPUESTOS",
    totalPresupuestado: 0,
    totalReal: 0,
    expanded: false,
    items: [
      {
        id: "impuesto-carro",
        descripcion: "Impuesto Carro",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "impuesto-casa",
        descripcion: "Impuesto Casa",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "impuesto-apto",
        descripcion: "Impuesto Apto",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "declaracion-milo",
        descripcion: "Declaración Milo",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "declaracion-miguel",
        descripcion: "Declaración Miguel",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "camara-comercio",
        descripcion: "Cámara de comercio",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "referyfuente",
        descripcion: "Referyfuente",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
    ],
  },
  {
    id: "ahorros",
    nombre: "AHORROS",
    totalPresupuestado: 5000000,
    totalReal: 0,
    expanded: false,
    items: [
      {
        id: "inversion",
        descripcion: "Inversión",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "mitierra",
        descripcion: "Mitierra",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "roman",
        descripcion: "Román",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 5000000,
        real: 0,
      },
    ],
  },
  {
    id: "alice",
    nombre: "ALICE",
    totalPresupuestado: 2305323,
    totalReal: 0,
    expanded: false,
    items: [
      {
        id: "matricula-alice",
        descripcion: "Matrícula Alice",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "pension-alice",
        descripcion: "Pensión Alice",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 1620750,
        real: 0,
      },
      {
        id: "alimentacion-alice",
        descripcion: "Alimentación Alice",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 547071,
        real: 0,
      },
      {
        id: "utiles-alice",
        descripcion: "Útiles Alice",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "trabajos-alice",
        descripcion: "Trabajos Alice",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "ropa-alice",
        descripcion: "Ropa Alice",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "zapatos-alice",
        descripcion: "Zapatos Alice",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "cursos-alice",
        descripcion: "Cursos Alice",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 137500,
        real: 0,
      },
      {
        id: "juguetes-alice",
        descripcion: "Juguetes Alice",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
    ],
  },
  {
    id: "abril",
    nombre: "ABRIL",
    totalPresupuestado: 47500,
    totalReal: 150000,
    expanded: false,
    items: [
      {
        id: "matricula-abril",
        descripcion: "Matrícula Abril",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "pension-abril",
        descripcion: "Pensión Abril",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "alimentacion-abril",
        descripcion: "Alimentación Abril",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "utiles-abril",
        descripcion: "Útiles Abril",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "trabajos-abril",
        descripcion: "Trabajos Abril",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "ropa-abril",
        descripcion: "Ropa Abril",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "zapatos-abril",
        descripcion: "Zapatos Abril",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "cursos-abril",
        descripcion: "Cursos Abril",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 47500,
        real: 0,
      },
      {
        id: "juguetes-abril",
        descripcion: "Juguetes Abril",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 150000,
      },
    ],
  },
  {
    id: "mascotas",
    nombre: "MASCOTAS",
    totalPresupuestado: 62000,
    totalReal: 0,
    expanded: false,
    items: [
      {
        id: "comida-mascotas",
        descripcion: "Comida Mascotas",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 45000,
        real: 0,
      },
      {
        id: "arena",
        descripcion: "Arena",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 17000,
        real: 0,
      },
      {
        id: "juguetes-mascotas",
        descripcion: "Juguetes",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "veterinario",
        descripcion: "Veterinario",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "vacunas",
        descripcion: "Vacunas",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "purga",
        descripcion: "Purga",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
    ],
  },
  {
    id: "educacion",
    nombre: "EDUCACIÓN",
    totalPresupuestado: 379000,
    totalReal: 0,
    expanded: false,
    items: [
      {
        id: "curso-online",
        descripcion: "Curso online",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 179000,
        real: 0,
      },
      {
        id: "capacitaciones",
        descripcion: "Capacitaciones",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "conferencias",
        descripcion: "Conferencias",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "presencial",
        descripcion: "Presencial",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "libros",
        descripcion: "Libros",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "membresia",
        descripcion: "Membresía",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 200000,
        real: 0,
      },
    ],
  },
  {
    id: "comunicaciones",
    nombre: "COMUNICACIONES",
    totalPresupuestado: 46751,
    totalReal: 0,
    expanded: false,
    items: [
      {
        id: "minutos",
        descripcion: "Minutos",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 46751,
        real: 0,
      },
      {
        id: "celular",
        descripcion: "Celular",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "recargas",
        descripcion: "Recargas",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "minutos-miguel",
        descripcion: "Minutos Miguel",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
    ],
  },
  {
    id: "salud",
    nombre: "SALUD",
    totalPresupuestado: 729000,
    totalReal: 25735,
    expanded: false,
    items: [
      {
        id: "seguridad-social",
        descripcion: "Seguridad Social",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 425000,
        real: 0,
      },
      {
        id: "eps",
        descripcion: "Eps",
        fecha: "",
        clasificacion: "Fijo",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "medicamentos",
        descripcion: "Medicamentos",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "copagos",
        descripcion: "Copagos",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "vitaminas",
        descripcion: "Vitaminas",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "suplementos",
        descripcion: "Suplementos",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 304000,
        real: 0,
      },
      {
        id: "dentista",
        descripcion: "Dentista",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "drogueria",
        descripcion: "Droguería",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 0,
        real: 25735,
      },
    ],
  },
  {
    id: "mercado",
    nombre: "MERCADO",
    totalPresupuestado: 1210000,
    totalReal: 312507,
    expanded: false,
    items: [
      {
        id: "verduras-frutas",
        descripcion: "Verduras y frutas",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 350000,
        real: 60524,
      },
      {
        id: "carnes",
        descripcion: "Carnes",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 400000,
        real: 175256,
      },
      {
        id: "lacena",
        descripcion: "Lacena",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 150000,
        real: 32727,
      },
      {
        id: "dulces",
        descripcion: "Dulces",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 20000,
        real: 0,
      },
      {
        id: "aseo",
        descripcion: "Aseo",
        fecha: "",
        clasificacion: "Variable",
        control: "Necesario",
        presupuestado: 180000,
        real: 0,
      },
      {
        id: "congelados",
        descripcion: "Congelados",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 80000,
        real: 0,
      },
      {
        id: "licores",
        descripcion: "Licores",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 44000,
      },
      {
        id: "varios",
        descripcion: "Varios",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 30000,
        real: 0,
      },
    ],
  },
  {
    id: "gastos-personales",
    nombre: "GASTOS PERSONALES",
    totalPresupuestado: 250000,
    totalReal: 157446,
    expanded: false,
    items: [
      {
        id: "salidas",
        descripcion: "Salidas",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 250000,
        real: 0,
      },
      {
        id: "restaurantes-gp",
        descripcion: "Restaurantes",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 200000,
        real: 0,
      },
      {
        id: "juegos",
        descripcion: "Juegos",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 50000,
        real: 0,
      },
      {
        id: "paseos",
        descripcion: "Paseos",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "cine",
        descripcion: "Cine",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "diversion-ocio",
        descripcion: "Diversión y Ocio",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "compras",
        descripcion: "Compras",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "regalos",
        descripcion: "Regalos",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "cuidado-personal",
        descripcion: "CUIDADO PERSONAL",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "vestuario",
        descripcion: "Vestuario",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "maquillaje",
        descripcion: "Maquillaje",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "peluqueria",
        descripcion: "Peluquería",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "zapatos-gp",
        descripcion: "Zapatos",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "libros-gp",
        descripcion: "Libros",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "barberia",
        descripcion: "Barbería",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "zapatos-mg",
        descripcion: "Zapatos Mg",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "vestuario-mg",
        descripcion: "Vestuario Mg",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "libros-mg",
        descripcion: "Libros",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "suscripciones-gp",
        descripcion: "SUSCRIPCIONES",
        fecha: "",
        clasificacion: "Fijo",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "suscripcion-pappi",
        descripcion: "Suscripción Pappi",
        fecha: "",
        clasificacion: "Fijo",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "suscripcion-chat-gpt",
        descripcion: "Suscripción Chat GPT",
        fecha: "",
        clasificacion: "Fijo",
        control: "Discrecional",
        presupuestado: 80000,
        real: 0,
      },
      {
        id: "suscripcion-netflix",
        descripcion: "Suscripción Netflix",
        fecha: "",
        clasificacion: "Fijo",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "vacaciones",
        descripcion: "VACACIONES",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 157446,
        real: 157446,
      },
      {
        id: "vuelos-gp",
        descripcion: "Vuelos",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 157446,
        real: 0,
      },
      {
        id: "hotel",
        descripcion: "Hotel",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
      {
        id: "alimentacion-gp",
        descripcion: "Alimentación",
        fecha: "",
        clasificacion: "Variable",
        control: "Discrecional",
        presupuestado: 0,
        real: 0,
      },
    ],
  },
];

export default function PresupuestoPage() {
  const [categorias, setCategorias] = useState<PresupuestoCategoria[]>(presupuestoMock);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    mode: 'add',
    categoriaId: '',
    item: undefined
  });
  const [formData, setFormData] = useState({
    descripcion: '',
    fecha: '',
    clasificacion: 'Fijo' as const,
    control: 'Necesario' as const,
    presupuestado: 0,
    real: 0
  });

  // Función para expandir/contraer categorías
  const toggleCategoria = (categoriaId: string) => {
    setCategorias(prev =>
      prev.map(cat =>
        cat.id === categoriaId ? { ...cat, expanded: !cat.expanded } : cat
      )
    );
  };

  // Función para abrir el modal de agregar detalle
  const openAddModal = (categoriaId: string) => {
    setModalState({
      isOpen: true,
      mode: 'add',
      categoriaId,
      item: undefined
    });
    setFormData({
      descripcion: '',
      fecha: '',
      clasificacion: 'Fijo',
      control: 'Necesario',
      presupuestado: 0,
      real: 0
    });
  };

  // Función para abrir el modal de editar detalle
  const openEditModal = (categoriaId: string, item: PresupuestoItem) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      categoriaId,
      item
    });
    setFormData({
      descripcion: item.descripcion,
      fecha: item.fecha,
      clasificacion: item.clasificacion,
      control: item.control,
      presupuestado: item.presupuestado,
      real: item.real
    });
  };

  // Función para cerrar el modal
  const closeModal = () => {
    setModalState({
      isOpen: false,
      mode: 'add',
      categoriaId: '',
      item: undefined
    });
    setFormData({
      descripcion: '',
      fecha: '',
      clasificacion: 'Fijo',
      control: 'Necesario',
      presupuestado: 0,
      real: 0
    });
  };

  // Función para guardar los cambios
  const handleSave = () => {
    if (modalState.mode === 'add') {
      // Agregar nuevo detalle
      const newItem: PresupuestoItem = {
        id: `${modalState.categoriaId}-${Date.now()}`,
        descripcion: formData.descripcion,
        fecha: formData.fecha,
        clasificacion: formData.clasificacion,
        control: formData.control,
        presupuestado: formData.presupuestado,
        real: formData.real
      };

      setCategorias(prev => 
        prev.map(cat => 
          cat.id === modalState.categoriaId 
            ? { 
                ...cat, 
                items: [...cat.items, newItem],
                totalPresupuestado: cat.totalPresupuestado + newItem.presupuestado,
                totalReal: cat.totalReal + newItem.real
              }
            : cat
        )
      );
    } else if (modalState.mode === 'edit' && modalState.item) {
      // Editar detalle existente
      const oldItem = modalState.item;
      setCategorias(prev => 
        prev.map(cat => 
          cat.id === modalState.categoriaId 
            ? { 
                ...cat, 
                items: cat.items.map(item => 
                  item.id === oldItem.id 
                    ? { ...item, ...formData }
                    : item
                ),
                totalPresupuestado: cat.totalPresupuestado - oldItem.presupuestado + formData.presupuestado,
                totalReal: cat.totalReal - oldItem.real + formData.real
              }
            : cat
        )
      );
    }

    closeModal();
  };

  // Función para obtener el color de la clasificación
  const getClasificacionColor = (clasificacion: string) => {
    switch (clasificacion) {
      case "Fijo":
        return "bg-blue-900/30 text-blue-300";
      case "Variable":
        return "bg-purple-900/30 text-purple-300";
      case "Discrecional":
        return "bg-amber-900/30 text-amber-300";
      default:
        return "bg-gray-900/30 text-gray-300";
    }
  };

  // Función para obtener el color del control
  const getControlColor = (control: string) => {
    switch (control) {
      case "Necesario":
        return "bg-emerald-900/30 text-emerald-300";
      case "Discrecional":
        return "bg-amber-900/30 text-amber-300";
      default:
        return "bg-gray-900/30 text-gray-300";
    }
  };

  // Función para formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-400 mb-2">
            Presupuesto Mensual - Julio 2025
          </h1>
          <p className="text-gray-300">
            Presupuestado vs Real
          </p>
        </div>

        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle>Categorías de Presupuesto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Clasificación
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Control
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Presupuestado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Real
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {categorias.map((categoria) => (
                    <>
                      {/* Fila de categoría principal */}
                      <tr
                        key={categoria.id}
                        className="bg-slate-800/50 hover:bg-slate-800/70 cursor-pointer transition-colors"
                        onClick={() => toggleCategoria(categoria.id)}
                      >
                        <td className="px-4 py-4 font-semibold text-white flex items-center">
                          {categoria.expanded ? (
                            <ChevronDown className="w-4 h-4 mr-2" />
                          ) : (
                            <ChevronRight className="w-4 h-4 mr-2" />
                          )}
                          {categoria.nombre}
                        </td>
                        <td className="px-4 py-4 text-gray-300">-</td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-200">
                            Categoría
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-300">-</td>
                        <td className="px-4 py-4 font-semibold text-blue-300">
                          {formatCurrency(categoria.totalPresupuestado)}
                        </td>
                        <td className="px-4 py-4 font-semibold text-emerald-300">
                          {formatCurrency(categoria.totalReal)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddModal(categoria.id);
                              }}
                              className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Funcionalidad para editar categoría (opcional)
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Filas de detalle (expandibles) */}
                      {categoria.expanded &&
                        categoria.items.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-white/5 transition-colors bg-slate-900/30"
                          >
                            <td className="px-4 py-3 pl-12 text-gray-200">
                              {item.descripcion}
                            </td>
                            <td className="px-4 py-3 text-gray-300">
                              {item.fecha}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getClasificacionColor(
                                  item.clasificacion
                                )}`}
                              >
                                {item.clasificacion}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getControlColor(
                                  item.control
                                )}`}
                              >
                                {item.control}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-blue-300">
                              {formatCurrency(item.presupuestado)}
                            </td>
                            <td className="px-4 py-3 text-emerald-300">
                              {item.real > 0 ? formatCurrency(item.real) : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => openEditModal(categoria.id, item)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Modal para agregar/editar detalles */}
        <Dialog open={modalState.isOpen} onOpenChange={closeModal}>
          <DialogContent className="sm:max-w-[425px] bg-slate-800/95 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                {modalState.mode === 'add' ? 'Agregar Nuevo Detalle' : 'Editar Detalle'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="descripcion" className="text-white">
                  Descripción
                </Label>
                <Input
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="Ingrese la descripción"
                />
              </div>

              {/* Fecha */}
              <div className="space-y-2">
                <Label htmlFor="fecha" className="text-white">
                  Fecha
                </Label>
                <Input
                  id="fecha"
                  value={formData.fecha}
                  onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="ej: 15/mes"
                />
              </div>

              {/* Clasificación */}
              <div className="space-y-2">
                <Label className="text-white">Clasificación</Label>
                <div className="flex gap-4">
                  {['Fijo', 'Variable', 'Discrecional'].map((tipo) => (
                    <label key={tipo} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="clasificacion"
                        value={tipo}
                        checked={formData.clasificacion === tipo}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          clasificacion: e.target.value as 'Fijo' | 'Variable' | 'Discrecional'
                        }))}
                        className="text-blue-500"
                      />
                      <span className="text-white text-sm">{tipo}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Control */}
              <div className="space-y-2">
                <Label className="text-white">Control</Label>
                <div className="flex gap-4">
                  {['Necesario', 'Discrecional'].map((tipo) => (
                    <label key={tipo} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="control"
                        value={tipo}
                        checked={formData.control === tipo}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          control: e.target.value as 'Necesario' | 'Discrecional'
                        }))}
                        className="text-blue-500"
                      />
                      <span className="text-white text-sm">{tipo}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Presupuestado */}
              <div className="space-y-2">
                <Label htmlFor="presupuestado" className="text-white">
                  Presupuestado
                </Label>
                <Input
                  id="presupuestado"
                  type="number"
                  value={formData.presupuestado}
                  onChange={(e) => setFormData(prev => ({ ...prev, presupuestado: Number(e.target.value) }))}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="0"
                />
              </div>

              {/* Real */}
              <div className="space-y-2">
                <Label htmlFor="real" className="text-white">
                  Real
                </Label>
                <Input
                  id="real"
                  type="number"
                  value={formData.real}
                  onChange={(e) => setFormData(prev => ({ ...prev, real: Number(e.target.value) }))}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="0"
                />
              </div>

              {/* Botones */}
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button variant="gradient" onClick={handleSave}>
                  {modalState.mode === 'add' ? 'Agregar' : 'Guardar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 