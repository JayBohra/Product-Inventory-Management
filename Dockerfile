# syntax=docker/dockerfile:1

# ---- 1. Build the Angular app ------------------------------------------------------------
FROM node:24-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2. Build the Spring Boot jar (with the Angular app inside) and unpack it --------------
FROM eclipse-temurin:25-jdk AS backend
WORKDIR /app/backend
COPY backend/.mvn/ .mvn/
COPY backend/mvnw backend/pom.xml ./
RUN ./mvnw -B -q dependency:go-offline
COPY backend/src/ src/
COPY --from=frontend /app/frontend/dist/frontend/browser/ src/main/resources/static/
RUN ./mvnw -B -q -DskipTests package \
    && cp target/sharelist-api-*.jar app.jar \
    && java -Djarmode=tools -jar app.jar extract --destination /app/extracted

# ---- 3. Runtime image --------------------------------------------------------------------
FROM eclipse-temurin:25-jre
WORKDIR /app
RUN groupadd --system app && useradd --system --gid app --no-create-home app
COPY --from=backend /app/extracted/ ./

# Sized for small instances such as free hosting tiers (512 MB, a fraction of a CPU):
# serial GC, a fixed heap, the quick C1 compiler only, and bean wiring generated at build time.
# The AOT cache below is only valid with these exact settings, so they live here.
ENV JAVA_TOOL_OPTIONS="-XX:+UseSerialGC -Xms128m -Xmx300m -XX:TieredStopAtLevel=1 -Dspring.aot.enabled=true"

# Start the app once to record a JVM AOT cache of everything it loads; every real start replays
# it and boots several times faster. No database exists during the build, so this run skips
# migrations and Hibernate's schema checks.
RUN java -XX:AOTCacheOutput=app.aot \
        -Dspring.context.exit=onRefresh \
        -Dapp.aot-training=true \
        -Dspring.jpa.hibernate.ddl-auto=none \
        -Dspring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=false \
        -Dspring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect \
        -jar app.jar

USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:AOTCache=app.aot", "-jar", "app.jar"]
