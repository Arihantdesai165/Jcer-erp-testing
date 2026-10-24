import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import logger from './logger.util';

/**
 * Official College Banner aspect ratio (Width: 2172 px, Height: 386 px => 5.626943 : 1)
 */
export const OFFICIAL_BANNER_ASPECT_RATIO = 2172 / 386;

export interface BannerPlacementOptions {
  /**
   * Total columns of the worksheet/table.
   */
  totalCols: number;
  /**
   * 1-indexed column where the table begins. Default: 1.
   */
  startCol?: number;
  /**
   * 0-indexed row float for top anchor (e.g. 0.10 means 10% into Row 1).
   * Default: 0.10
   */
  startRow?: number;
  /**
   * Target banner width in pixels. If omitted, calculated proportionally based on table width.
   */
  targetWidth?: number;
  /**
   * Target banner height in pixels. If omitted, calculated from aspect ratio.
   */
  targetHeight?: number;
  /**
   * Optional pre-defined column widths array.
   */
  columnWidths?: number[];
}

export interface InstitutionalHeaderOptions {
  totalCols: number;
  startCol?: number;
  departmentName?: string;
  semester?: number;
  academicYear?: string;
  reportTitle?: string;
  subTitle?: string;
  location?: string;
  bannerWidth?: number;
  bannerHeight?: number;
  bannerStartRow?: number;
}

export interface LogoPlacementOptions {
  col?: number;
  row?: number;
  width?: number;
  height?: number;
  totalCols?: number;
  startCol?: number;
  titleText?: string;
  columnWidths?: number[];
}

let cachedBannerBuffer: Buffer | null = null;
let cachedLogoBuffer: Buffer | null = null;

/**
 * Resolves and caches the official combined college header banner image buffer.
 * Image contains: JGI logo, Jain College of Engineering & Research, affiliation, and Belagavi.
 */
export function getOfficialCollegeBannerBuffer(): Buffer | null {
  if (cachedBannerBuffer) {
    return cachedBannerBuffer;
  }

  const candidatePaths = [
    path.resolve(__dirname, '../assets/Excelheader.png'),
    path.resolve(__dirname, '../../assets/Excelheader.png'),
    path.resolve(__dirname, '../../../frontend/public/Excelheader.png'),
    path.resolve(process.cwd(), 'src/assets/Excelheader.png'),
    path.resolve(process.cwd(), 'assets/Excelheader.png'),
    path.resolve(process.cwd(), '../frontend/public/Excelheader.png'),
    path.resolve(process.cwd(), 'frontend/public/Excelheader.png'),
    path.resolve(process.cwd(), 'public/Excelheader.png'),
    'e:/JCER-ERP-SYSTEM/Admission_process/backend/src/assets/Excelheader.png',
    'e:/JCER-ERP-SYSTEM/Admission_process/frontend/public/Excelheader.png',
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        cachedBannerBuffer = fs.readFileSync(p);
        logger.info(`Loaded official college banner from: ${p}`);
        return cachedBannerBuffer;
      }
    } catch {
      // Continue search
    }
  }

  logger.warn('Official college banner image file (Excelheader.png) not found in candidate paths.');
  return null;
}

/**
 * Resolves and caches the legacy institutional logo buffer (if needed).
 */
export function getOfficialInstitutionalLogoBuffer(): Buffer | null {
  if (cachedLogoBuffer) {
    return cachedLogoBuffer;
  }

  const candidatePaths = [
    path.resolve(__dirname, '../assets/logo.png'),
    path.resolve(__dirname, '../../assets/logo.png'),
    path.resolve(__dirname, '../../../frontend/public/logo.png'),
    path.resolve(process.cwd(), 'src/assets/logo.png'),
    path.resolve(process.cwd(), '../frontend/public/logo.png'),
    path.resolve(process.cwd(), 'public/logo.png'),
    'e:/JCER-ERP-SYSTEM/Admission_process/backend/src/assets/logo.png',
    'e:/JCER-ERP-SYSTEM/Admission_process/frontend/public/logo.png',
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        cachedLogoBuffer = fs.readFileSync(p);
        return cachedLogoBuffer;
      }
    } catch {
      // Continue search
    }
  }

  logger.warn('Institutional logo file not found in candidate paths.');
  return null;
}

/**
 * Dynamically computes the optimal proportional width, height, and fractional column anchor
 * for the official college banner image so that:
 * 1. The original aspect ratio (5.626943) is strictly preserved without stretching or distortion.
 * 2. It is centered horizontally across the usable report width.
 * 3. It scales gracefully for narrow and wide worksheets.
 */
export function calculateBannerPlacement(
  worksheet: ExcelJS.Worksheet,
  options: {
    totalCols: number;
    startCol?: number;
    columnWidths?: number[];
    targetWidth?: number;
    targetHeight?: number;
  }
): { colAnchor: number; width: number; height: number; totalTableWidthPx: number } {
  const { totalCols, startCol = 1, columnWidths, targetWidth, targetHeight } = options;

  // 1. Gather pixel widths of all report columns
  const colWidthsPx: number[] = [];
  let totalTableWidthPx = 0;

  for (let c = startCol; c <= totalCols; c++) {
    let w = 12; // Standard fallback character width
    if (columnWidths && columnWidths[c - 1] !== undefined) {
      w = columnWidths[c - 1];
    } else {
      const colDef = worksheet.getColumn(c);
      if (colDef && typeof colDef.width === 'number' && colDef.width > 0) {
        w = colDef.width;
      }
    }
    const px = w * 7.5; // ~7.5 px per Excel column width unit at 96 DPI
    colWidthsPx.push(px);
    totalTableWidthPx += px;
  }

  // 2. Determine balanced proportional banner width and height preserving 5.626943 ratio
  let width = targetWidth;
  let height = targetHeight;

  if (!width && !height) {
    if (totalTableWidthPx > 1400) {
      width = 750;
    } else if (totalTableWidthPx > 800) {
      width = 680;
    } else {
      width = Math.min(Math.max(totalTableWidthPx * 0.90, 420), 620);
    }
    height = Math.round(width / OFFICIAL_BANNER_ASPECT_RATIO);
  } else if (width && !height) {
    height = Math.round(width / OFFICIAL_BANNER_ASPECT_RATIO);
  } else if (!width && height) {
    width = Math.round(height * OFFICIAL_BANNER_ASPECT_RATIO);
  }

  // 3. Calculate horizontal centering anchor
  const leftOffsetPx = Math.max(0, (totalTableWidthPx - (width || 600)) / 2);

  let cumPx = 0;
  let colAnchor = startCol - 1;
  for (let i = 0; i < colWidthsPx.length; i++) {
    const colPx = colWidthsPx[i];
    if (cumPx + colPx >= leftOffsetPx) {
      const fraction = (leftOffsetPx - cumPx) / colPx;
      colAnchor = startCol - 1 + i + Math.min(Math.max(fraction, 0), 0.98);
      break;
    }
    cumPx += colPx;
  }

  return {
    colAnchor: Number(colAnchor.toFixed(2)),
    width: width || 600,
    height: height || 107,
    totalTableWidthPx,
  };
}

/**
 * Embeds the official combined college banner image into an Excel worksheet.
 * Preserves the exact 5.626943 aspect ratio, centers it horizontally across the report columns,
 * and leaves no duplicate institutional text.
 */
export function embedOfficialCollegeBanner(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  options: BannerPlacementOptions
): number | undefined {
  const bannerBuffer = getOfficialCollegeBannerBuffer();
  if (!bannerBuffer) {
    logger.warn('Cannot embed banner: Excelheader.png buffer not found');
    return undefined;
  }

  let bannerImageId: number;
  try {
    bannerImageId = workbook.addImage({
      buffer: bannerBuffer as any,
      extension: 'png',
    });
  } catch (err: any) {
    logger.warn(`Failed to add banner image to workbook: ${err.message}`);
    return undefined;
  }

  const {
    totalCols,
    startCol = 1,
    startRow = 0.10,
    targetWidth,
    targetHeight,
    columnWidths,
  } = options;

  const placement = calculateBannerPlacement(worksheet, {
    totalCols,
    startCol,
    columnWidths,
    targetWidth,
    targetHeight,
  });

  try {
    worksheet.addImage(bannerImageId, {
      tl: { col: placement.colAnchor, row: startRow },
      ext: { width: placement.width, height: placement.height },
    });
    return bannerImageId;
  } catch (err: any) {
    logger.warn(`Failed to place banner image on worksheet '${worksheet.name}': ${err.message}`);
    return undefined;
  }
}

/**
 * Standard institutional report header renderer across JCER ERP:
 * 1. Allocates Rows 1 to 3 with appropriate row heights for the official banner.
 * 2. Embeds the official college banner horizontally centered across the table width.
 * 3. Renders the report-specific title on Row 4 with clear typography and no overlap.
 * 4. Eliminates duplicate college name, affiliation, and address text.
 */
export function applyInstitutionalHeader(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  options: InstitutionalHeaderOptions
): number | undefined {
  const {
    totalCols,
    startCol = 1,
    departmentName,
    semester,
    academicYear,
    reportTitle,
    bannerWidth,
    bannerHeight,
    bannerStartRow = 0.10,
  } = options;

  // 1. Configure Rows 1-3 heights to contain the banner cleanly without overlap
  worksheet.getRow(1).height = 32;
  worksheet.getRow(2).height = 32;
  worksheet.getRow(3).height = 30;

  // 2. Clear any old text in Rows 1-3 across columns
  for (let r = 1; r <= 3; r++) {
    for (let c = startCol; c <= totalCols; c++) {
      const cell = worksheet.getCell(r, c);
      cell.value = '';
    }
  }

  // 3. Embed the official college banner image centered across totalCols
  const imageId = embedOfficialCollegeBanner(workbook, worksheet, {
    totalCols,
    startCol,
    startRow: bannerStartRow,
    targetWidth: bannerWidth,
    targetHeight: bannerHeight,
  });

  // 4. Row 4: Department / Cohort Title Block (below banner)
  if (reportTitle || departmentName) {
    const finalReportTitle =
      reportTitle ||
      `DEPARTMENT OF ${departmentName?.toUpperCase()} — SEMESTER ${semester} CONSOLIDATED ATTENDANCE REGISTER (${academicYear})`;
    worksheet.mergeCells(4, startCol, 4, totalCols);
    const row4 = worksheet.getCell(4, startCol);
    row4.value = finalReportTitle;
    row4.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    row4.alignment = { vertical: 'middle', horizontal: 'center' };
    row4.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' },
    };
    worksheet.getRow(4).height = 22;
  }

  return imageId;
}

/**
 * Backward compatibility helper for legacy logo embedding
 */
export function calculateLogoColumnAnchor(
  worksheet: ExcelJS.Worksheet,
  options: {
    totalCols: number;
    startCol?: number;
    titleText?: string;
    columnWidths?: number[];
    logoWidthPx?: number;
  }
): number {
  return calculateBannerPlacement(worksheet, options).colAnchor;
}

/**
 * Backward compatibility helper for legacy logo embedding
 */
export function embedInstitutionalLogo(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  options: LogoPlacementOptions = {}
): number | undefined {
  return embedOfficialCollegeBanner(workbook, worksheet, {
    totalCols: options.totalCols || 10,
    startCol: options.startCol || 1,
    startRow: options.row || 0.10,
    targetWidth: options.width,
    targetHeight: options.height,
    columnWidths: options.columnWidths,
  });
}
