FROM public.ecr.aws/lambda/nodejs:20

# Install MongoDB tools
RUN yum install -y wget tar gzip && \
    wget https://fastdl.mongodb.org/tools/db/mongodb-database-tools-amazon2-x86_64-100.9.4.tgz && \
    tar -xzf mongodb-database-tools-amazon2-x86_64-100.9.4.tgz && \
    mv mongodb-database-tools-amazon2-x86_64-100.9.4/bin/* /usr/local/bin/ && \
    rm -rf mongodb-database-tools-amazon2-x86_64-100.9.4* && \
    yum clean all

# Copy package files
COPY package*.json ${LAMBDA_TASK_ROOT}/

# Install dependencies
RUN npm ci --production

# Copy source code
COPY src/ ${LAMBDA_TASK_ROOT}/src/

# Set handler
CMD [ "src/index.handler" ]
