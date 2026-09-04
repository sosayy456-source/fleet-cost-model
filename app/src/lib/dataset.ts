/**
 * เลือกชุดข้อมูลตอนรัน — sample (ค่าเริ่มต้น) หรือ real
 *
 * GitHub Pages ถูกบังคับให้ build ด้วย sample เสมอผ่าน .github/workflows/deploy.yml
 * ส่วนข้อมูลจริงรันในเครื่องด้วย VITE_DATASET=real npm run dev
 * (ไฟล์ใต้ public/data/real/ ติด .gitignore จึงไม่มีทางขึ้น repo)
 */
export const DATASET = (import.meta.env.VITE_DATASET as string) || "sample";
export const IS_SAMPLE = DATASET === "sample";

/** path ฐานของไฟล์ข้อมูลที่ ETL สร้าง (เคารพ base ของ Vite) */
export const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${DATASET}/${file}`;
