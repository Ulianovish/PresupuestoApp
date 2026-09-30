'use client';

/**
 * UnlinkPhoneButton - Molecule Level
 *
 * "Desvincular" de un número de WhatsApp en Ajustes. Pide confirmación y
 * llama a unlinkWhatsAppLinkAction con el id del link (contratos §5.2): el
 * número completo nunca llega al navegador, aquí solo está el enmascarado.
 * La acción revalida /settings, así que la lista se actualiza sola al
 * terminar.
 */

import React, { useState } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import ConfirmModal from '@/components/atoms/ConfirmModal/ConfirmModal';
import { unlinkWhatsAppLinkAction } from '@/lib/actions/whatsapp';

import { confirmarDesvinculo } from './confirmar-desvinculo';

interface UnlinkPhoneButtonProps {
  linkId: string;
  maskedPhone: string;
}

export default function UnlinkPhoneButton({
  linkId,
  maskedPhone,
}: UnlinkPhoneButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const confirmar = async () => {
    setLoading(true);
    try {
      const cerrar = await confirmarDesvinculo(linkId, {
        unlink: unlinkWhatsAppLinkAction,
        toast,
      });
      if (cerrar) setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-red-400 hover:bg-red-900/30 hover:text-red-300"
      >
        Desvincular
      </Button>
      <ConfirmModal
        isOpen={open}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
        onConfirm={confirmar}
        title="Desvincular número"
        message={`El número ${maskedPhone} dejará de registrar gastos en tu presupuesto. Para volver a conectarlo tendrás que generar un código nuevo.`}
        confirmText="Desvincular"
        cancelText="Cancelar"
        isLoading={loading}
        loadingText="Desvinculando..."
      />
    </>
  );
}
