package com.sharelist.common;

import java.util.List;
import java.util.Map;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Renders errors as RFC 9457 problem details with an extra {@code code} property. */
@RestControllerAdvice
class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ProblemDetail> handleApiException(ApiException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(ex.code().status(), ex.getMessage());
        problem.setTitle(ex.code().title());
        problem.setProperty("code", ex.code().name());
        ex.details().forEach(problem::setProperty);
        return ResponseEntity.status(ex.code().status()).body(problem);
    }

    /** Last line of defence: a database constraint caught something the service checks missed. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> handleIntegrityViolation(DataIntegrityViolationException ex) {
        logger.warn("Data integrity violation", ex);
        return handleApiException(new ApiException(ErrorCode.CONFLICT,
                "That change conflicts with another one. Please refresh and try again."));
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<Map<String, String>> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> Map.of(
                        "field", error.getField(),
                        "message", String.valueOf(error.getDefaultMessage())))
                .toList();
        ProblemDetail problem = ex.getBody();
        problem.setDetail(errors.isEmpty()
                ? "Some fields are invalid."
                : errors.getFirst().get("field") + ": " + errors.getFirst().get("message"));
        problem.setProperty("code", "VALIDATION_FAILED");
        problem.setProperty("errors", errors);
        return handleExceptionInternal(ex, problem, headers, status, request);
    }
}
