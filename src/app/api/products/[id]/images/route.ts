/**
 * API route for uploading product images.
 *
 * POST /api/products/[id]/images — Upload an image to Supabase Storage (Admin only)
 *
 * Validates: Requirements 1.3
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { hasPermission } from '@/lib/auth/permissions';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_PRODUCT_IMAGES,
} from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
        { status: 401 }
      );
    }

    // Get user role and check permission
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !hasPermission(userProfile.role as UserRole, 'product.create')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'No tiene permisos para subir imágenes' } },
        { status: 403 }
      );
    }

    // Verify product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Producto no encontrado' } },
        { status: 404 }
      );
    }

    // Check current image count
    const { count: imageCount } = await supabase
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);

    if ((imageCount ?? 0) >= MAX_PRODUCT_IMAGES) {
      return NextResponse.json(
        {
          error: {
            code: 'MAX_IMAGES_REACHED',
            message: `El producto ya tiene el máximo de ${MAX_PRODUCT_IMAGES} imágenes`,
          },
        },
        { status: 400 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No se proporcionó archivo de imagen' } },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_FILE_TYPE',
            message: `Tipo de archivo no permitido. Formatos aceptados: JPG, PNG, WebP`,
          },
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: {
            code: 'FILE_TOO_LARGE',
            message: `El archivo excede el tamaño máximo de 5 MB`,
          },
        },
        { status: 400 }
      );
    }

    // Generate unique file path
    const ext = file.name.split('.').pop() ?? 'jpg';
    const timestamp = Date.now();
    const filePath = `${id}/${timestamp}.${ext}`;

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: { code: 'UPLOAD_ERROR', message: uploadError.message } },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('product-images').getPublicUrl(filePath);

    // Determine if this should be the primary image
    const isPrimary = (imageCount ?? 0) === 0;

    // Get optional color and sort_order from form data
    const color = formData.get('color') as string | null;
    const sortOrder = Number.parseInt(formData.get('sort_order') as string, 10) || (imageCount ?? 0);

    // Create product_images record
    const { data: imageRecord, error: insertError } = await supabase
      .from('product_images')
      .insert({
        product_id: id,
        color: color || null,
        image_url: publicUrl,
        thumbnail_url: null,
        optimized_url: null,
        sort_order: sortOrder,
        is_primary: isPrimary,
      })
      .select('id, image_url, thumbnail_url, optimized_url, sort_order, is_primary, color, created_at')
      .single();

    if (insertError || !imageRecord) {
      return NextResponse.json(
        { error: { code: 'CREATE_ERROR', message: insertError?.message ?? 'Error al registrar imagen' } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: imageRecord }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 }
    );
  }
}
