FROM public.ecr.aws/lambda/nodejs:20

# Install MongoDB tools using microdnf (newer AL2023 base image)
RUN microdnf install -y wget tar gzip && \
    wget https://fastdl.mongodb.org/tools/db/mongodb-database-tools-amazon2023-x86_64-100.9.5.tgz && \
    tar -xzf mongodb-database-tools-amazon2023-x86_64-100.9.5.tgz && \
    mv mongodb-database-tools-amazon2023-x86_64-100.9.5/bin/* /usr/local/bin/ && \
    rm -rf mongodb-database-tools-amazon2023-x86_64-100.9.5* && \
    microdnf clean all

# Copy package files
COPY package*.json ${LAMBDA_TASK_ROOT}/

# Install dependencies
RUN npm ci --production

# Copy source code
COPY src/ ${LAMBDA_TASK_ROOT}/src/

# Set handler
CMD [ "src/index.handler" ]
