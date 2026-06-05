import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transcriptsRouter from "./transcripts";
import tagsRouter from "./tags";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(transcriptsRouter);
router.use(tagsRouter);
router.use(settingsRouter);

export default router;
