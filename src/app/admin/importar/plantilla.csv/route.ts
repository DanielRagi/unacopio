import { PLANTILLA_CSV } from '@/lib/importacion';

/**
 * La plantilla que se le manda a quien tiene la lista.
 *
 * Con BOM para que Excel en Windows no le rompa las tildes: quien la va a
 * llenar la abre ahí, no en un editor de texto.
 */
export function GET() {
  return new Response(`﻿${PLANTILLA_CSV}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="plantilla-unacopio.csv"',
      'cache-control': 'public, max-age=3600',
    },
  });
}
