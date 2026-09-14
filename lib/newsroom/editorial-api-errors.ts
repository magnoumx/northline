import { EditorialWriteError } from "../editorial/article-write-service";
import { apiErrorResponse } from "../security/api";

export function editorialWriteErrorResponse(error: unknown): Response {
  if (!(error instanceof EditorialWriteError)) {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Editorial storage is temporarily unavailable.",
    });
  }
  if (error.code === "NOT_FOUND") {
    return apiErrorResponse("NOT_FOUND", {
      status: 404,
      message: error.message,
    });
  }
  if (error.code === "FORBIDDEN_ACTOR") {
    return apiErrorResponse("FORBIDDEN", {
      status: 403,
      message: error.message,
    });
  }
  if (
    error.code === "VERSION_CONFLICT" ||
    error.code === "IDEMPOTENCY_CONFLICT" ||
    error.code === "IMMUTABLE_PUBLIC_VERSION" ||
    error.code === "PUBLICATION_PACKET_INCOMPLETE"
  ) {
    return apiErrorResponse("CONFLICT", {
      status: 409,
      message: error.message,
    });
  }
  return apiErrorResponse("UNAVAILABLE", {
    status: 503,
    message: "Editorial storage is temporarily unavailable.",
  });
}
